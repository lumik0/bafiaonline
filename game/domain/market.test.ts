import { describe, expect, test } from "bun:test";
import { Connection, ServerClient } from "@common/net";
import { createFakeNetwork, instantDelay } from "@common/net/testing";
import { languageCode, Market, safePaymentUrl } from "./market";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

async function setup() {
  const network = createFakeNetwork();
  const client = new ServerClient(new Connection({ url: "ws://test", createSocket: () => network.createSocket(), delay: instantDelay }));
  client.session = { userObjectId: "uo1", token: "token" };
  client.connect();
  await tick();
  return { network, market: new Market(client, "RUS") };
}

const response = {
  mr: {
    u: "Euaek", uac: { gcns: 10, scns: 9963 },
    mbi: [
      { mpid: "gold800", tt: "800 золота", dsc: "Золотые монеты", mct: 1, mca: 800, puk: "https://pay.example.com/p?id=1", iprct: "1250 руб" },
      { mpid: "bad", tt: "x", puk: "javascript:alert(1)" }
    ],
    mitms: [{ mitm: { itmid: 3, itmt: 0, itmps: { "1": { "0": "по умолчанию", "1": "👑" } } }, mos: [{ moid: 7, moct: 1, mod: 2592000, mop: 200 }] }],
    mdcrs: [{ mdcr: { did: 1, dt: 1, dp: { "1": { "0": "#FFFF0000", "1": "#FF00FF00" } } }, mos: [{ moid: 9, moct: 0, mod: 86400, mop: 500 }] }],
    misc: [{ mpid: "silver", mca: 100000, mop: 1000 }]
  }
};

describe("Market", () => {
  test("магазин для себя: запрос с типом оплаты «сайт», разбор предложений, ссылки только https", async() => {
    const { network, market } = await setup();
    network.respond = (packet, socket) => packet.ty == "mrktg" && socket.receive({ ty: "mrktg", ...response });

    const view = await market.load();
    expect(network.last.sent[0]).toEqual({ ty: "mrktg", mbt: 1, alc: "RUS", uo: "uo1", t: "token" });
    expect(view).toMatchObject({ username: "Euaek", gold: 10, silver: 9963 });
    expect(view.decorations).toEqual([{ id: 1, type: 1, offers: [{ id: 9, coin: "silver", seconds: 86400, price: 500 }], options: [{ type: "1", variants: [{ id: 0, label: "#FFFF0000" }, { id: 1, label: "#FF00FF00" }] }] }]);
    expect(view.money.map(item => [item.productId, item.priceText, item.url])).toEqual([["gold800", "1250 руб", "https://pay.example.com/p?id=1"], ["bad", "", undefined]]);
    expect(view.items[0]).toEqual({
      id: 3, vip: true,
      offers: [{ id: 7, coin: "gold", seconds: 2592000, price: 200 }],
      options: [{ type: "1", variants: [{ id: 0, label: "по умолчанию" }, { id: 1, label: "👑" }] }]
    });
  });

  test("магазин для другого игрока по нику", async() => {
    const { network, market } = await setup();
    network.respond = (packet, socket) => packet.ty == "mrktgg" && socket.receive({ ty: "mrktgg", ...response });
    await market.load("Друг");
    expect(network.last.sent[0]).toEqual({ ty: "mrktgg", mbt: 1, ur: "Друг", alc: "RUS", uo: "uo1", t: "token" });
  });

  test("покупка за монеты: пакет без токена, ответ «куплено» и «рюкзак полон»", async() => {
    const { network, market } = await setup();
    network.respond = (packet, socket) => packet.ty == "mrktg" && socket.receive({ ty: "mrktg", ...response });
    const item = (await market.load()).items[0]!;

    network.respond = (packet, socket) => packet.ty == "mbuyi" && socket.receive({ ty: "mbis", tt: "VIP", itmt: 0, uac: { gcns: 5, scns: 9963 } });
    expect(await market.buy(item, item.offers[0]!, { "1": 1 })).toEqual({ status: "ok", title: "VIP", gold: 5, silver: 9963 });
    expect(network.last.sent.at(-1)).toEqual({ ty: "mbuyi", mbuyir: { itmid: 3, moid: 7, itmps: { "1": 1 } } });

    network.respond = (packet, socket) => packet.ty == "mbuyi" && socket.receive({ ty: "bisfe", biamnt: 5, bps: 5 });
    expect(await market.buy(item, item.offers[0]!)).toEqual({ status: "full", size: 5 });
    expect(network.last.sent.at(-1)).toMatchObject({ mbuyir: { itmps: { "1": 0 } } });   // без выбора - первый вариант
  });

  test("покупка украшения: пакет bd с выбранным вариантом, монеты из ответа", async() => {
    const { network, market } = await setup();
    network.respond = (packet, socket) => packet.ty == "mrktg" && socket.receive({ ty: "mrktg", ...response });
    const decoration = (await market.load()).decorations[0]!;

    network.respond = (packet, socket) => packet.ty == "bd" && socket.receive({ ty: "mbds", dt: 1, uac: { gcns: 10, scns: 400 } });
    expect(await market.buyDecoration(decoration, decoration.offers[0]!, { "1": 1 })).toEqual({ status: "ok", gold: 10, silver: 400 });
    expect(network.last.sent.at(-1)).toEqual({ ty: "bd", bdr: { did: 1, moid: 9, dp: { "1": 1 } } });
  });

  test("пакет серебра: bsci с id пакета; нет ответа - «неизвестно», итог смотрит экран по монетам", async() => {
    const { network, market } = await setup();
    network.respond = (packet, socket) => packet.ty == "mrktg" && socket.receive({ ty: "mrktg", ...response });
    const pack = (await market.load()).silverPacks[0]!;
    expect(pack).toEqual({ productId: "silver", coins: 100000, price: 1000 });

    network.respond = (packet, socket) => packet.ty == "bsci" && socket.receive({ ty: "mbis", uac: { gcns: 3, scns: 100009 } });
    expect(await market.buySilverPack(pack)).toEqual({ status: "ok", gold: 3, silver: 100009 });
    expect(network.last.sent.at(-1)).toEqual({ ty: "bsci", mpid: "silver", uo: "uo1", t: "token" });
  });

  test("мелочи: ссылка оплаты и код языка", () => {
    expect(safePaymentUrl("https://a.com/x")).toBe("https://a.com/x");
    for(const bad of ["http://a.com", "javascript:1", "https://user:pw@a.com", "не ссылка", undefined]) expect(safePaymentUrl(bad)).toBeUndefined();
    expect(languageCode("ru-RU")).toBe("RUS");
    expect(languageCode("de")).toBe("ENG");
  });
});
