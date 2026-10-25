import { describe, expect, test } from "bun:test";
import { Connection, ServerClient } from "@common/net";
import { createFakeNetwork, instantDelay } from "@common/net/testing";
import { createStorage, MemoryFileStore } from "@common/storage";
import { Friends } from "../friends";
import { SettingsStore } from "../settings";
import { GlobalChat } from "./global";
import { PrivateChat } from "./private";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

async function setup() {
  const network = createFakeNetwork();
  const client = new ServerClient(new Connection({ url: "ws://test", createSocket: () => network.createSocket(), delay: instantDelay }));
  client.session = { userObjectId: "uo1", token: "t" };
  client.connect();
  await tick();
  const settings = await SettingsStore.load(createStorage(new MemoryFileStore()).settings);
  return { network, client, settings };
}

describe("GlobalChat", () => {
  test("список приходит пакетом, новые сообщения добавляются, игроки обновляются", async() => {
    const { network, client, settings } = await setup();
    const chat = new GlobalChat(client, settings);
    chat.open();
    expect(network.last.sent[0]).toEqual({ ty: "acc", uo: "uo1", t: "t" });

    network.last.receive({ ty: "ms", ms: [{ tx: "раз", uu: { u: "A", puo: "p1" } }, { t: 2, uu: { u: "B" } }] });
    network.last.receive({ ty: "m", m: { tx: "два", uu: { u: "A", puo: "p1", v: "👑" } } });
    network.last.receive({ ty: "u", u: [{ u: "A", puo: "p1" }, { u: "B", puo: "p2" }] });

    expect(chat.entries.map(entry => `${entry.kind}:${entry.text}`)).toEqual(["message:раз", "join:", "message:два"]);
    expect(chat.entries[2]!.user?.vip).toBe("👑");
    expect(chat.users.map(user => user.username)).toEqual(["A", "B"]);
  });

  test("отправка: опьянение бармена, пустое не отправляется", async() => {
    const { network, client, settings } = await setup();
    const chat = new GlobalChat(client, settings);

    chat.send("привет");
    chat.send("   ");
    chat.send("!абв");

    const sent = network.last.sent.filter(packet => packet.ty == "cmc");
    expect(sent).toHaveLength(2);
    expect(sent[0]!.m).toEqual({ tx: "привет", mstl: 0, mstk: false });
    expect(sent[1]!.m.tx).toHaveLength(3);
    expect(sent[1]!.m.tx).not.toContain("а");
  });

  test("после close() пакеты больше не меняют чат", async() => {
    const { network, client, settings } = await setup();
    const chat = new GlobalChat(client, settings);
    chat.open();
    chat.close();

    network.last.receive({ ty: "m", m: { tx: "поздно", uu: { u: "A" } } });
    expect(chat.entries).toHaveLength(0);
  });
});

describe("PrivateChat", () => {
  test("открытие, история, пометка прочитанным, новые сообщения и «печатает»", async() => {
    const { network, client, settings } = await setup();
    const chat = new PrivateChat(client, settings, "fr1");
    chat.open();
    expect(network.last.sent[0]).toMatchObject({ ty: "acpc", fp: "fr1" });

    network.last.receive({ ty: "pcmsr", ms: [{ o: "m1", puo: "p2", tx: "привет", c: 1000, a: 1 }, { o: "m2", puo: "p1", tx: "ку", c: 2000, a: 0 }, { o: "m4", puo: "p1", tx: "и так бывает", c: 2500, a: false }, { o: "m5", puo: "p2", tx: "и так", c: 2600, a: true }] });
    expect(chat.loaded).toBe(true);
    // «прочитано» сервер присылает то числом, то true/false (так и сломались личные сообщения)
    expect(chat.messages.map(message => [message.from, message.read])).toEqual([["p2", true], ["p1", false], ["p1", false], ["p2", true]]);
    expect(network.last.sent.at(-1)).toEqual({ ty: "ac", fp: "fr1" });

    network.last.receive({ ty: "pruit" });
    expect(chat.typing).toBe(true);
    network.last.receive({ ty: "pcmr", m: { o: "m3", puo: "p2", tx: "как дела", c: 3000, a: 1 } });
    network.last.receive({ ty: "pruint" });
    expect(chat.typing).toBe(false);
    expect(chat.messages).toHaveLength(5);

    chat.send("отлично");
    expect(network.last.sent.at(-1)).toEqual({ ty: "pmc", fp: "fr1", m: { tx: "отлично", mstl: 3, mstk: false } });
  });
});

describe("Friends", () => {
  test("друзья, входящие заявки и поиск превращаются в простые записи", async() => {
    const { network, client } = await setup();
    const friends = new Friends(client);
    network.respond = (packet, socket) => {
      if(packet.ty == "acfl") socket.receive({ ty: "frl", frl: { frl: [{ o: "fr1", ff: { puo: "p2", u: "Друг", ph: "m1", on: true }, nm: "3", up: 1700000000000, rr: { o: "room1" } }] } });
      if(packet.ty == "gsfrl") socket.receive({ ty: "frl", frl: { frl: [{ o: "fr2", uu: { puo: "p3", u: "Проситель" }, a: 0 }, { o: "fr3", uu: { u: "без id" } }] } });
      if(packet.ty == "su") socket.receive({ ty: "su", u: [{ puo: "p4", u: "Найден", on: false }] });
    };

    expect(await friends.friends()).toEqual([{ friendshipId: "fr1", playerObjectId: "p2", username: "Друг", photo: "m1", isOnline: true, updated: 1700000000000, newMessages: 3, incoming: false, roomId: "room1" }]);

    const requests = await friends.requests();
    expect(requests).toHaveLength(1);        // запись без playerObjectId отбрасывается
    expect(requests[0]).toMatchObject({ username: "Проситель", incoming: true });

    expect(await friends.search("Най")).toEqual([{ playerObjectId: "p4", username: "Найден", photo: undefined, isOnline: false, newMessages: 0, incoming: false }]);
  });
});
