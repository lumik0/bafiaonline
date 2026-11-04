import { describe, expect, test } from "bun:test";
import { Connection, ServerClient } from "@common/net";
import { createFakeNetwork, instantDelay } from "@common/net/testing";
import { createStorage, MemoryFileStore } from "@common/storage";
import { Friends } from "../friends";
import { SettingsStore } from "../settings";
import { GlobalChat } from "./global";
import { HIDDEN_MAX, messageKey, PrivateChat, toEntries, type PrivateMessage } from "./private";

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

describe("строки личной переписки", () => {
  const me = { playerObjectId: "me", username: "Я" }, peer = { playerObjectId: "p1", username: "Друг" };
  const message = (id: number, from: string, read = true): PrivateMessage => ({ id, from, text: "текст " + id, created: 1000 + id, read });

  test("строки одних и тех же сообщений остаются теми же объектами: список не перерисовывается целиком на каждое событие", () => {
    const messages = [message(1, "p1"), message(2, "me"), message(3, "p1")];
    const first = toEntries(messages, new Map(), me, peer);
    expect(first.list.map(entry => [entry.id, entry.user?.username, entry.unread])).toEqual([[1, "Друг", false], [2, "Я", false], [3, "Друг", false]]);

    // событие «печатает…»: те же сообщения - те же строки
    const again = toEntries(messages, first.known, me, peer);
    expect(again.list.every((entry, i) => entry === first.list[i])).toBe(true);

    // пришло ещё одно: старые строки на месте, новая добавилась
    const more = toEntries([...messages, message(4, "p1")], again.known, me, peer);
    expect(more.list.slice(0, 3).every((entry, i) => entry === first.list[i])).toBe(true);
    expect(more.list).toHaveLength(4);
  });

  test("меняется только та строка, у которой изменилось «прочитано»; удалённые сообщения уходят из кэша", () => {
    const unread = [message(1, "me", false), message(2, "me", false), message(3, "p1")];
    const first = toEntries(unread, new Map(), me, peer);
    expect(first.list[0]!.unread).toBe(true);

    const readFirst = toEntries([{ ...unread[0]!, read: true }, unread[1]!, unread[2]!], first.known, me, peer);
    expect(readFirst.list[0]).not.toBe(first.list[0]);
    expect(readFirst.list[0]!.unread).toBe(false);
    expect(readFirst.list[1]).toBe(first.list[1]);
    expect(readFirst.list[2]).toBe(first.list[2]);

    const trimmed = toEntries([unread[2]!], readFirst.known, me, peer);
    expect([...trimmed.known.keys()]).toEqual([3]);
  });
});

describe("подписка чатов после переподключения", () => {
  test("общий чат: после переоткрытия связи подписываемся заново и получаем чат целиком; закрытый чат не подписывается", async() => {
    const { network, client, settings } = await setup();
    const chat = new GlobalChat(client, settings);
    chat.resubscribe();                                         // чат не открывали: ничего не шлём
    expect(network.last.sent.filter(packet => packet.ty == "acc")).toHaveLength(0);

    chat.open();
    chat.resubscribe();
    expect(network.last.sent.filter(packet => packet.ty == "acc")).toHaveLength(2);
    network.last.receive({ ty: "ms", ms: [{ tx: "после переподключения", uu: { u: "A", puo: "p1" } }] });
    expect(chat.entries.map(entry => entry.text)).toEqual(["после переподключения"]);

    chat.close();
    chat.resubscribe();
    expect(network.last.sent.filter(packet => packet.ty == "acc")).toHaveLength(2);
  });

  test("личная переписка: после переоткрытия связи переписка открывается заново для той же дружбы", async() => {
    const { network, client, settings } = await setup();
    const chat = new PrivateChat(client, settings, "f1");
    chat.resubscribe();
    expect(network.last.sent.filter(packet => packet.ty == "acpc")).toHaveLength(0);

    chat.open();
    chat.resubscribe();
    const opened = network.last.sent.filter(packet => packet.ty == "acpc");
    expect(opened).toHaveLength(2);
    expect(opened[1]).toMatchObject({ fp: "f1" });

    chat.close();
    chat.resubscribe();
    expect(network.last.sent.filter(packet => packet.ty == "acpc")).toHaveLength(2);
  });
});

describe("удаление личных сообщений у себя", () => {
  const history = (network: { last: { receive(packet: unknown): void } }) =>
    network.last.receive({ ty: "pcmsr", ms: [{ o: "m1", puo: "p2", tx: "привет", c: 1000, a: 1 }, { o: "m2", puo: "p1", tx: "ку", c: 2000, a: 1 }, { o: "m3", puo: "p2", tx: "как дела", c: 3000, a: 1 }] });

  test("удалённое пропадает у меня и остаётся в сохранённых настройках; собеседника это не касается (сообщение в списке целиком)", async() => {
    const { network, client, settings } = await setup();
    const chat = new PrivateChat(client, settings, "fr1");
    chat.open();
    history(network);
    const changes: number[] = [];
    chat.on("change", () => changes.push(1));

    expect(chat.hide(chat.messages[1]!.id)).toBe(true);
    expect(chat.visible.map(message => message.text)).toEqual(["привет", "как дела"]);
    expect(chat.messages).toHaveLength(3);                       // сами данные не тронуты
    expect(changes).toHaveLength(1);
    expect(settings.data.hiddenPrivate.fr1).toEqual([messageKey(chat.messages[1]!)]);

    expect(chat.hide(9999)).toBe(false);                         // такого сообщения нет
    chat.hide(chat.messages[1]!.id);                             // повторное удаление ничего не дублирует
    expect(settings.data.hiddenPrivate.fr1).toHaveLength(1);
  });

  test("после перезахода (сообщения загрузились заново, номера другие) удалённое остаётся удалённым; в другой переписке такого же текста - нет", async() => {
    const { network, client, settings } = await setup();
    const chat = new PrivateChat(client, settings, "fr1");
    chat.open();
    history(network);
    chat.hide(chat.messages[2]!.id);

    const again = new PrivateChat(client, settings, "fr1");
    again.open();
    history(network);
    expect(again.messages[2]!.id).not.toBe(chat.messages[2]!.id);   // номер другой, ключ тот же
    expect(again.visible.map(message => message.text)).toEqual(["привет", "ку"]);

    const other = new PrivateChat(client, settings, "fr2");
    other.open();
    history(network);
    expect(other.visible).toHaveLength(3);
  });

  test("ключ зависит от времени, автора и текста; помним не больше лимита, самые старые забываются", async() => {
    expect(messageKey({ from: "p1", text: "а", created: 1 })).not.toBe(messageKey({ from: "p2", text: "а", created: 1 }));
    expect(messageKey({ from: "p1", text: "а", created: 1 })).not.toBe(messageKey({ from: "p1", text: "б", created: 1 }));
    expect(messageKey({ from: "p1", text: "а", created: 1 })).not.toBe(messageKey({ from: "p1", text: "а", created: 2 }));
    expect(messageKey({ from: "p1", text: "а", created: 1 })).toBe(messageKey({ from: "p1", text: "а", created: 1 }));

    const { network, client, settings } = await setup();
    const chat = new PrivateChat(client, settings, "fr1");
    chat.open();
    network.last.receive({ ty: "pcmsr", ms: Array.from({ length: 150 }, (_, i) => ({ o: "m" + i, puo: "p2", tx: "текст " + i, c: 1000 + i, a: 1 })) });
    for(let round = 0; round < 4; round++) {
      for(const message of [...chat.visible]) chat.hide(message.id);
      network.last.receive({ ty: "pcmsr", ms: Array.from({ length: 150 }, (_, i) => ({ o: "m" + i, puo: "p2", tx: `текст ${round + 1}.${i}`, c: 1000 + i, a: 1 })) });
    }
    expect(settings.data.hiddenPrivate.fr1!.length).toBeLessThanOrEqual(HIDDEN_MAX);
  });
});

describe("удаление личных сообщений у обоих", () => {
  const history = (network: { last: { receive(packet: unknown): void } }) =>
    network.last.receive({ ty: "pcmsr", ms: [{ o: "m1", puo: "p2", tx: "привет", c: 1000, a: 1 }, { o: "m2", puo: "p1", tx: "моё сообщение", c: 2000, a: 1 }, { puo: "p1", tx: "без номера", c: 2500, a: 1 }, { o: "m3", puo: "p2", tx: "как дела", c: 3000, a: 1 }] });

  test("у сообщения есть номер сервера; удаление шлёт запрос, а пропадает сообщение только по событию сервера", async() => {
    const { network, client, settings } = await setup();
    const chat = new PrivateChat(client, settings, "fr1");
    chat.open();
    history(network);
    expect(chat.messages.map(message => message.objectId)).toEqual(["m1", "m2", undefined, "m3"]);

    expect(chat.remove(chat.messages[1]!.id)).toBe(true);
    expect(network.last.sent.at(-1)).toEqual({ ty: "prmd", fp: "fr1", o: "m2" });
    expect(chat.messages).toHaveLength(4);                       // до ответа сервера сообщение на месте

    const changes: number[] = [];
    chat.on("change", () => changes.push(1));
    network.last.receive({ ty: "prmd", o: "m2" });
    expect(chat.messages.map(message => message.text)).toEqual(["привет", "без номера", "как дела"]);
    expect(changes).toHaveLength(1);
  });

  test("собеседник удалил своё сообщение - оно пропадает и у тебя; событие про неизвестное сообщение ничего не меняет", async() => {
    const { network, client, settings } = await setup();
    const chat = new PrivateChat(client, settings, "fr1");
    chat.open();
    history(network);
    const changes: number[] = [];
    chat.on("change", () => changes.push(1));

    network.last.receive({ ty: "prmd", o: "m3" });
    expect(chat.messages.map(message => message.text)).toEqual(["привет", "моё сообщение", "без номера"]);
    network.last.receive({ ty: "prmd", o: "нет такого" });
    expect(chat.messages).toHaveLength(3);
    expect(changes).toHaveLength(1);
  });

  test("нет номера на сервере или такого сообщения - запрос не уходит; после close события не слушаются", async() => {
    const { network, client, settings } = await setup();
    const chat = new PrivateChat(client, settings, "fr1");
    chat.open();
    history(network);
    const sent = network.last.sent.length;
    expect(chat.remove(chat.messages[2]!.id)).toBe(false);       // «без номера»
    expect(chat.remove(99999)).toBe(false);
    expect(network.last.sent).toHaveLength(sent);

    chat.close();
    network.last.receive({ ty: "prmd", o: "m1" });
    expect(chat.messages.map(message => message.objectId)).toContain("m1");
  });
});

