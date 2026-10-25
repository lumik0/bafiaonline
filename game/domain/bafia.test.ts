import { describe, expect, test } from "bun:test";
import type { SocketLike } from "@common/net/connection";
import Events from "@common/utils/emitter";
import { Bafia, BafiaLink, newKey } from "./bafia";

/** сокет, который отвечает как сервер Бафии: «ok» на всё, а «who» возвращает заданных игроков */
function serverSocket(online: string[], log: Record<string, unknown>[]) {
  const sockets: SocketLike[] = [];
  const create = (): SocketLike => {
    const socket: SocketLike = {
      onopen: null, onmessage: null, onclose: null, onerror: null,
      send(text: string) {
        const message = JSON.parse(text);
        log.push(message);
        const reply = message.t == "redeem" ? (message.code == "BAF-GOOD-CODE" ? { t: "premium", n: message.n, until: 4_000_000_000_000 } : { t: "error", n: message.n, reason: "invalid" })
          : message.t == "gifUpload" ? { t: "ok", n: message.n }
          : message.t == "gifs" ? { t: "gifs", n: message.n, items: [{ id: "own1", url: "https://media.tenor.com/a.gif", title: "Свой" }, { id: "up1", url: "/g/upload01", title: "Загруженный" }, { id: "evil", url: "http://evil.example.com/x.gif", title: "" }] }
          : message.t == "histPut" ? (message.data.length > 400 ? { t: "error", n: message.n, reason: "quota" } : { t: "hist", n: message.n, id: "abcdefghij12" })
          : message.t == "histGet" ? { t: "hist", n: message.n, id: message.id, data: message.id == "abcdefghij12" ? JSON.stringify({ messages: [{ x: 1 }, 5], playersData: { p1: { role: 1 }, p2: 3 }, title: "Игра", evil: "x" }) : undefined }
          : message.t == "hello" ? { t: "ok", n: message.n, gifKey: "GKEY" }
          : message.t == "style" ? { t: "ok", n: message.n }
          : message.t == "who" ? { t: "online", n: message.n, ids: message.ids.filter((id: string) => online.includes(id)), premium: message.ids.filter((id: string) => id == "pp"), colors: message.ids.includes("pp") ? { pp: "blue", bad: "нет" } : {} }
          : message.t == "gif" ? { t: "gif", n: message.n, id: message.id, url: message.id == "evil" ? "https://evil.example.com/a.gif" : message.id == "cat" ? "https://media.giphy.com/cat.gif" : undefined, title: "Кот" }
          : message.t == "nicks" ? { t: "nicks", n: message.n, id: message.id, names: [{ nick: "Старый", first: 1, last: 2 }] }
          : { t: "ok", n: message.n };
        queueMicrotask(() => socket.onmessage?.({ data: JSON.stringify(reply) }));
      },
      close() {}
    } as SocketLike;
    sockets.push(socket);
    queueMicrotask(() => socket.onopen?.());
    return socket;
  };
  return { create, sockets };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 5));
const KEY = "k".repeat(24);

describe("BafiaLink", () => {
  test("hello с ключом, потом presence; спрашивает, кто в Бафии, и помнит ответ", async() => {
    const log: Record<string, unknown>[] = [];
    const { create } = serverSocket(["p2"], log);
    const link = new BafiaLink({ url: "ws://test", key: KEY, createSocket: create });
    link.identify("p1", "Euaek");
    link.start();
    await tick();

    expect(log.map(message => message.t)).toEqual(["hello", "presence"]);
    expect(log[0]).toMatchObject({ key: KEY, version: 1 });
    expect(log[1]).toMatchObject({ id: "p1", nick: "Euaek" });

    await link.watch([{ id: "p1", nick: "Euaek" }, { id: "p2", nick: "Друг" }]);
    expect([...link.online]).toEqual(["p2"]);
    expect(await link.nicks("p2")).toEqual([{ nick: "Старый", first: 1, last: 2 }]);
    link.stop();
  });

  test("гифка: адрес по номеру кэшируется; чужой хост и неизвестный номер дают null", async() => {
    const log: Record<string, unknown>[] = [];
    const link = new BafiaLink({ url: "ws://test", key: KEY, createSocket: serverSocket([], log).create });
    link.start();
    await tick();

    expect(await link.gif("cat")).toEqual({ id: "cat", url: "https://media.giphy.com/cat.gif", title: "Кот" });
    await link.gif("cat");
    expect(log.filter(message => message.t == "gif")).toHaveLength(1);
    expect(await link.gif("evil")).toBeNull();
    expect(await link.gif("nope")).toBeNull();
    link.stop();
  });

  test("поиск гифок: вкладка Бафия - каталог сервера (файлы сервера достраиваются), вкладка Giphy - ключом от сервера; сбой Giphy - undefined", async() => {
    const urls: string[] = [];
    let status = 200;
    const http = (async(url: URL) => {
      urls.push(url.toString());
      return Response.json({ data: [{ id: "ICOgUNjpvO0PC", title: "Cat" }, { id: "bad id" }] }, { status });
    }) as unknown as typeof fetch;
    const { clearGiphyCache } = await import("./giphy");
    clearGiphyCache();
    const link = new BafiaLink({ url: "ws://test", fileBase: "http://srv:8787", key: KEY, createSocket: serverSocket([], []).create, fetch: http });
    link.start();
    await tick();

    const own = await link.gifs("cat", "bafia");
    expect(own?.map(item => [item.id, item.url])).toEqual([["own1", "https://media.tenor.com/a.gif"], ["up1", "http://srv:8787/g/upload01"]]);

    const found = await link.gifs("cat", "giphy");
    expect(found?.map(item => item.id)).toEqual(["g_ICOgUNjpvO0PC"]);
    expect(found?.[0]?.thumb).toBe("https://media.giphy.com/media/ICOgUNjpvO0PC/200w.gif");
    expect(urls[0]).toContain("api_key=GKEY");

    status = 429;
    clearGiphyCache();
    expect(await link.gifs("dog", "giphy")).toBeUndefined();
    link.stop();
  });

  test("загрузка гифки: файл уходит в base64, причины отказа приходят как есть", async() => {
    const sent: Record<string, unknown>[] = [];
    const link = new BafiaLink({ url: "ws://test", key: KEY, createSocket: serverSocket([], sent).create });
    link.start();
    await tick();
    const bytes = new Uint8Array([71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    expect(await link.uploadGif("Кот", bytes)).toEqual({ ok: true });
    expect(sent.find(message => message.t == "gifUpload")).toMatchObject({ title: "Кот", data: "R0lGODlhAQABAAAAAAAAAAAAAAA=" });
    expect(await link.uploadGif("Кот", new Uint8Array(4 * 1024 * 1024))).toEqual({ error: "too-big" });
    link.stop();
  });

  test("история игры: отправка даёт номер, получение очищает чужие данные, нет - null", async() => {
    const link = new BafiaLink({ url: "ws://test", key: KEY, createSocket: serverSocket([], []).create });
    link.start();
    await tick();
    const record = { messages: [], playersData: {}, modelType: 0, title: "Т", maxPlayers: 8, minPlayers: 5, minLevel: 1, isVipEnabled: false, selectedRoles: [], gameDayTime: 0, createdAt: 1 };

    expect(await link.shareHistory(record)).toEqual({ id: "abcdefghij12" });
    expect(await link.shareHistory({ ...record, title: "x".repeat(500) })).toEqual({ error: "quota" });

    const loaded = await link.loadHistory("abcdefghij12");
    expect(loaded).toMatchObject({ title: "Игра", messages: [{ x: 1 }], playersData: { p1: { role: 1 } }, maxPlayers: 8 });
    expect(loaded).not.toHaveProperty("evil");
    expect(Object.keys(loaded!.playersData)).toEqual(["p1"]);
    expect(await link.loadHistory("zzzzzzzzzzzz")).toBeNull();
    link.stop();
  });

  test("премиум: код активируется, при неверном - причина; сохранённый код активируется сам на новой установке", async() => {
    const link = new BafiaLink({ url: "ws://test", key: KEY, createSocket: serverSocket([], []).create });
    link.start();
    await tick();
    expect(await link.redeem("NOPE")).toEqual({ error: "invalid" });
    expect(link.premiumUntil).toBeUndefined();
    expect(await link.redeem("BAF-GOOD-CODE")).toEqual({ until: 4_000_000_000_000 });
    expect(link.premiumUntil).toBe(4_000_000_000_000);
    link.stop();

    const log: Record<string, unknown>[] = [];
    const restored = new BafiaLink({ url: "ws://test", key: "n".repeat(24), createSocket: serverSocket([], log).create });
    restored.savedCode = "BAF-GOOD-CODE";
    restored.start();
    await tick();
    expect(log.map(message => message.t)).toEqual(["hello", "redeem"]);
    expect(restored.premiumUntil).toBe(4_000_000_000_000);
    restored.stop();
  });

  test("цвет значка: свой уходит серверу при наличии премиума, чужие приходят вместе с «кто в Бафии»", async() => {
    const log: Record<string, unknown>[] = [];
    const link = new BafiaLink({ url: "ws://test", key: KEY, createSocket: serverSocket(["pp", "p9"], log).create });
    link.color = "red";
    link.savedCode = "BAF-GOOD-CODE";
    link.start();
    await tick();
    expect(log.map(message => message.t)).toEqual(["hello", "redeem", "style"]);
    expect(log.at(-1)).toMatchObject({ color: "red" });

    await link.watch([{ id: "pp", nick: "Премиум" }, { id: "p9", nick: "Обычный" }]);
    expect([...link.premiumOnline]).toEqual(["pp"]);
    expect(link.premiumColors.get("pp")).toBe("blue");
    expect(link.premiumColors.size).toBe(1);
    link.stop();
  });

  test("сервер молчит или недоступен: запросы заканчиваются пустым результатом, а не ошибкой", async() => {
    const silent = (): SocketLike => {
      const socket = { onopen: null, onmessage: null, onclose: null, onerror: null, send() {}, close() {} } as unknown as SocketLike;
      queueMicrotask(() => socket.onopen?.());
      return socket;
    };
    const link = new BafiaLink({ url: "ws://test", key: KEY, createSocket: silent, timeout: 20 });
    link.start();
    await tick();
    await expect(link.nicks("p1")).resolves.toBeUndefined();
    await link.watch([{ id: "p1", nick: "A" }]);
    expect(link.online.size).toBe(0);
    link.stop();
  });
});

describe("Bafia", () => {
  function setup() {
    const data = { bafia: { enabled: false, asked: false, key: "", code: "", color: "gold" } };
    const settings = new class extends Events<{ change: () => void }> {
      data = data;
      update(change: (value: typeof data) => void) { change(data); this.emit("change"); }
    }();
    const user = Object.assign(new Events<{ change: () => void }>(), { playerObjectId: "", username: "" });
    const log: Record<string, unknown>[] = [];
    const server = serverSocket([], log);
    const bafia = new Bafia({ settings, user, url: "ws://test", createSocket: server.create });
    return { bafia, settings, user, log, server, data };
  }

  test("по умолчанию выключено и ничего не отправляет; включение создаёт ключ и называет ник", async() => {
    const { bafia, user, log, server, data } = setup();
    await tick();
    expect(server.sockets).toHaveLength(0);

    bafia.setEnabled(true);
    expect(data.bafia.key).toHaveLength(48);
    user.playerObjectId = "p1";
    user.username = "Euaek";
    user.emit("change");
    await tick();
    expect(log.map(message => message.t)).toEqual(["hello", "presence"]);

    bafia.setEnabled(false);
    log.length = 0;
    bafia.played(true);
    await tick();
    expect(log).toEqual([]);
    bafia.dispose();
  });

  test("ключи случайные", () => {
    expect(newKey()).not.toBe(newKey());
  });
});
