import { describe, expect, test } from "bun:test";
import { Connection, ServerClient } from "@common/net";
import { createFakeNetwork, instantDelay } from "@common/net/testing";
import { argbToCss } from "./decorations";
import { Backpack, itemsWord, toActiveItem, vipIconSymbol } from "./backpack";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

async function setup() {
  const network = createFakeNetwork();
  const client = new ServerClient(new Connection({ url: "ws://test", createSocket: () => network.createSocket(), delay: instantDelay }));
  client.session = { userObjectId: "uo1", token: "token" };
  client.connect();
  await tick();
  return { network, backpack: new Backpack(client) };
}

describe("Backpack", () => {
  test("загрузка: активные предметы, свободные, размер", async() => {
    const { network, backpack } = await setup();
    network.respond = (packet, socket) => packet.ty == "bpg" && socket.receive({
      ty: "bpg",
      bp: { baits: [{ aio: "a1", itmt: 0, itmsps: { "0": 1, "1": 5 }, iea: 90 }], bits: ["i1", "i2"], bps: 20 }
    });

    expect(await backpack.load()).toEqual({
      active: [{ id: "a1", kind: "vip", icon: 5, iconHidden: true, secondsLeft: 90 }],
      decorations: [], activeDecorations: [], items: [{ id: "i1" }, { id: "i2" }], count: 2, size: 20
    });
  });

  test("украшения (настоящий пакет): цвет #AARRGGBB переводится для CSS, предмет считается", async() => {
    const { network, backpack } = await setup();
    network.respond = (packet, socket) => packet.ty == "bpg" && socket.receive({
      ty: "bpg", bp: { bds: [{ bio: "305066b8", dt: 8, dp: { "1": "#FFCE90F7" }, bid: 86400 }, { bio: "x" }], bps: 5 }
    });
    const content = await backpack.load();
    expect(content.decorations).toEqual([
      { id: "305066b8", type: 8, color: "#CE90F7FF", seconds: 86400 },
      { id: "x", type: undefined, color: undefined, seconds: undefined }
    ]);
    expect(content).toMatchObject({ count: 2, size: 5 });
    expect(argbToCss("#80FF0000")).toBe("#FF000080");
    expect(argbToCss("#abc")).toBe("#abc");
    expect(argbToCss("красный")).toBeUndefined();
  });

  test("предметы объектами (как у сервера), надетые украшения, действия с украшениями", async() => {
    const { network, backpack } = await setup();
    network.respond = (packet, socket) => {
      if(packet.ty == "bpg") socket.receive({ ty: "bpg", bp: { bits: [{ bio: "i1", itmt: 0, bid: 2592000 }], bads: [{ aio: "a1", dt: 8, dp: { "1": "#80FF0000" }, iea: 3600 }], bps: 5 } });
      const ack = ({ bda: "bdad", bdrm: "bdrmd", badrm: "badrmd" } as Record<string, string>)[packet.ty as string];
      if(ack) socket.receive({ ty: ack });
    };
    const content = await backpack.load();
    expect(content.items).toEqual([{ id: "i1", type: 0, seconds: 2592000 }]);
    expect(content.activeDecorations).toEqual([{ id: "a1", type: 8, color: "#FF000080", seconds: 3600 }]);

    await backpack.activateDecoration("d1");
    await backpack.removeDecoration("d2");
    await backpack.takeOffDecoration("a1");
    expect(network.last.sent.map(({ ty, bia, birm }) => ({ ty, bia, birm }))).toEqual([
      { ty: "bpg", bia: undefined, birm: undefined },
      { ty: "bda", bia: { bio: "d1" }, birm: undefined },
      { ty: "bdrm", bia: undefined, birm: { bio: "d2" } },
      { ty: "badrm", bia: undefined, birm: { bio: "a1" } }
    ]);
  });

  test("пустой рюкзак не падает", async() => {
    const { network, backpack } = await setup();
    network.respond = (packet, socket) => packet.ty == "bpg" && socket.receive({ ty: "bpg", bp: {} });
    expect(await backpack.load()).toEqual({ active: [], decorations: [], activeDecorations: [], items: [], count: 0, size: 0 });
  });

  test("действия шлют нужные пакеты и ждут подтверждение", async() => {
    const { network, backpack } = await setup();
    network.respond = (packet, socket) => {
      const ack = { bia: "biad", baied: "baiedd", bairm: "bairmd" }[packet.ty as string];
      if(ack) socket.receive({ ty: ack });
    };

    await backpack.activate("i1");
    await backpack.setIcon("a1", 7);
    await backpack.setIconHidden("a1", true);
    await backpack.remove("a1");

    const sent = network.last.sent.map(({ ty, bia, bied, birm }) => ({ ty, bia, bied, birm }));
    expect(sent).toEqual([
      // применить предмет: id внутри bia (не плоский bio) - иначе сервер ничего не делает
      { ty: "bia", bia: { bio: "i1" }, bied: undefined, birm: undefined },
      { ty: "baied", bia: undefined, bied: { bio: "a1", itmps: { "1": 7 } }, birm: undefined },
      { ty: "baied", bia: undefined, bied: { bio: "a1", itmps: { "0": 1 } }, birm: undefined },
      { ty: "bairm", bia: undefined, bied: undefined, birm: { bio: "a1" } }
    ]);
  });

  test("мелочи: склонение, значок по умолчанию, неизвестный тип", () => {
    expect([1, 2, 5, 11, 21].map(itemsWord)).toEqual(["предмет", "предмета", "предметов", "предметов", "предмет"]);
    expect(vipIconSymbol(0)).toBe(vipIconSymbol(1));
    expect(toActiveItem({ id: "x", type: 3 }).kind).toBe("unknown");
  });
});
