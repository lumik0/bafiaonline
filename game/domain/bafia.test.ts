import { describe, expect, test } from "bun:test";
import type { SocketLike } from "@common/net/connection";
import Events from "@common/utils/emitter";
import { BAFIA_LIMITS } from "@common/bafia/protocol";
import { versionNumber } from "@common/version";
import { Bafia, BafiaLink, FAVORITES_MAX, newKey } from "./bafia";

/** сокет, который отвечает как сервер Бафии: «ok» на всё, а «who» возвращает заданных игроков */
function serverSocket(online: string[], log: Record<string, unknown>[]) {
  const sockets: SocketLike[] = [];
  /** сервер молчит на проверку связи (тихо умершее соединение) */
  let deaf = false;
  const create = (): SocketLike => {
    const socket: SocketLike = {
      onopen: null, onmessage: null, onclose: null, onerror: null,
      send(text: string) {
        const message = JSON.parse(text);
        log.push(message);
        if(deaf && message.t == "ping") return;
        const reply = message.t == "redeem" ? (message.code == "BAF-GOOD-CODE" ? { t: "premium", n: message.n, until: 4_000_000_000_000 } : { t: "error", n: message.n, reason: "invalid" })
          : message.t == "gifUpload" ? { t: "ok", n: message.n }
          : message.t == "gifs" ? { t: "gifs", n: message.n, items: [{ id: "own1", url: "https://media.tenor.com/a.gif", title: "Свой" }, { id: "up1", url: "/g/upload01", title: "Загруженный" }, { id: "evil", url: "http://evil.example.com/x.gif", title: "" }] }
          : message.t == "histPut" ? (message.data.length > 400 ? { t: "error", n: message.n, reason: "quota" } : { t: "hist", n: message.n, id: "abcdefghij12" })
          : message.t == "histGet" ? { t: "hist", n: message.n, id: message.id, data: message.id == "abcdefghij12" ? JSON.stringify({ messages: [{ x: 1 }, 5], playersData: { p1: { role: 1 }, p2: 3 }, title: "Игра", evil: "x" }) : undefined }
          : message.t == "hello" ? { t: "ok", n: message.n, gifKey: "GKEY" }
          : message.t == "style" ? { t: "ok", n: message.n }
          : message.t == "avatarSet" ? (message.data == "AAAAAAAAAAAAAAAAAAAAAAAA" ? { t: "error", n: message.n, reason: "premium" } : { t: "ok", n: message.n, avatar: "/a/newavatar" })
          : message.t == "who" ? { t: "online", n: message.n, ids: message.ids.filter((id: string) => online.includes(id)), premium: message.ids.filter((id: string) => id == "pp"), colors: message.ids.includes("pp") ? { pp: "blue", bad: "нет" } : {}, avatars: message.ids.includes("pp") ? { pp: "/a/abcdef12", p9: "http://evil.example.com/x.gif" } : {} }
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
  return { create, sockets, deaf: (value: boolean) => { deaf = value; }, push: (message: object) => sockets.at(-1)!.onmessage?.({ data: JSON.stringify(message) }) };
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
    expect(await link.uploadGif("Кот", new Uint8Array(BAFIA_LIMITS.gifBytes + 1))).toEqual({ error: "too-big" });
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

  test("аватарки: чужие приходят вместе с «кто в Бафии» (чужой адрес отбрасывается), своя ставится и убирается", async() => {
    const log: Record<string, unknown>[] = [];
    const link = new BafiaLink({ url: "ws://test", key: KEY, createSocket: serverSocket(["pp", "p9"], log).create });
    link.savedCode = "BAF-GOOD-CODE";
    link.start();
    await tick();

    await link.watch([{ id: "pp", nick: "Премиум" }, { id: "p9", nick: "Обычный" }]);
    expect(link.avatars.get("pp")).toBe("/a/abcdef12");
    expect(link.avatars.has("p9")).toBe(false);

    expect(await link.setAvatar(new Uint8Array([71, 73, 70, 56, 57, 97, 1]))).toEqual({ ok: true });
    expect(log.at(-1)).toMatchObject({ t: "avatarSet", data: "R0lGODlhAQ==" });
    expect(link.myAvatar).toBe("/a/newavatar");
    expect(await link.setAvatar(new Uint8Array(BAFIA_LIMITS.avatarBytes + 1))).toEqual({ error: "too-big" });
    expect(await link.setAvatar(new Uint8Array(18))).toEqual({ error: "premium" });

    expect(await link.clearAvatar()).toBe(true);
    expect(log.at(-1)).toMatchObject({ t: "avatarClear" });
    expect(link.myAvatar).toBeUndefined();
    link.stop();
  });

  test("гифка Giphy: адрес строится по номеру без запроса к серверу и ведёт на лёгкую версию 200 px", async() => {
    const log: Record<string, unknown>[] = [];
    const link = new BafiaLink({ url: "ws://test", key: KEY, createSocket: serverSocket([], log).create });
    link.start();
    await tick();
    log.length = 0;
    expect(await link.gif("g_ICOgUNjpvO0PC")).toMatchObject({ id: "g_ICOgUNjpvO0PC", url: "https://media.giphy.com/media/ICOgUNjpvO0PC/200w.gif" });
    expect(log).toEqual([]);
    expect(await link.gif("g_ab")).toBeNull();   // плохой номер
    link.stop();
  });

  test("пульс: пока сервер отвечает на ping, соединение живёт; два молчания подряд - подключаемся заново и снова здороваемся", async() => {
    const log: Record<string, unknown>[] = [];
    const server = serverSocket([], log);
    const link = new BafiaLink({ url: "ws://test", key: KEY, createSocket: server.create, heartbeat: { interval: 15, timeout: 8 }, backoff: [1], delay: async() => {} });
    link.identify("p1", "Euaek");
    link.start();
    await tick();
    expect(server.sockets).toHaveLength(1);

    await new Promise(resolve => setTimeout(resolve, 60));
    expect(log.filter(message => message.t == "ping").length).toBeGreaterThan(1);
    expect(server.sockets).toHaveLength(1);            // отвечает: переподключений нет

    server.deaf(true);
    await new Promise(resolve => setTimeout(resolve, 70));
    expect(server.sockets.length).toBeGreaterThanOrEqual(2);
    server.deaf(false);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(log.filter(message => message.t == "hello").length).toBeGreaterThanOrEqual(2);
    expect(log.filter(message => message.t == "presence").length).toBeGreaterThanOrEqual(2);
    expect(link.isReady).toBe(true);
    link.stop();
    const count = server.sockets.length;
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(server.sockets).toHaveLength(count);        // после stop() пульс не работает
  });

  test("сообщение администратора приходит само, одно за другим; пустое и слишком длинное отбрасываются", async() => {
    const server = serverSocket([], []);
    const link = new BafiaLink({ url: "ws://test", key: KEY, createSocket: server.create });
    const got: string[] = [];
    link.on("notice", text => got.push(text));
    link.start();
    await tick();
    expect(got).toEqual([]);

    server.push({ t: "notice", n: 0, text: "Вышла новая версия" });
    server.push({ t: "notice", n: 0, text: "" });
    server.push({ t: "notice", n: 0, text: 5 });
    server.push({ t: "notice", n: 0, text: "я".repeat(BAFIA_LIMITS.notice + 1) });
    server.push({ t: "notice", n: 0, text: "Ещё одно" });
    expect(got).toEqual(["Вышла новая версия", "Ещё одно"]);
    link.stop();
  });

  test("игра получает сообщение администратора событием notice от Bafia", async() => {
    const data = { bafia: { enabled: false, asked: true, key: "k".repeat(24), code: "", color: "gold", favorites: [] } };
    const settings = new class extends Events<{ change: () => void }> {
      data = data;
      update(change: (value: typeof data) => void) { change(data); this.emit("change"); }
    }();
    const user = Object.assign(new Events<{ change: () => void }>(), { playerObjectId: "me", username: "Я" });
    const server = serverSocket([], []);
    const bafia = new Bafia({ settings, user, url: "ws://test", createSocket: server.create });
    const shown: string[] = [];
    bafia.on("notice", text => shown.push(text));
    await tick();
    server.push({ t: "notice", n: 0, text: "Обновись" });
    expect(shown).toEqual(["Обновись"]);                  // согласие на остальное не нужно
    bafia.dispose();
  });

  describe("состояние связи", () => {
    /** сокет, который не открылся (сервер отклонил подключение или недоступен) */
    const dead = (): SocketLike => ({ onopen: null, onmessage: null, onclose: null, onerror: null, send() {}, close() {} } as unknown as SocketLike);
    const tickMany = async() => { for(let i = 0; i < 4; i++) await tick(); };

    test("подключаюсь, нет связи с числом неудачных попыток, потом подключено и счёт обнуляется", async() => {
      const server = serverSocket([], []);
      let failures = 2;
      const sockets: SocketLike[] = [];
      const create = (): SocketLike => { const socket = failures-- > 0 ? dead() : server.create(); sockets.push(socket); return socket; };
      const link = new BafiaLink({ url: "ws://test", key: KEY, createSocket: create, backoff: [1], delay: async() => {} });
      const changes: string[] = [];
      link.on("change", () => changes.push(link.state));

      expect(link.state).toBe("connecting");
      link.start();
      sockets[0]!.onclose?.();                       // сервер не принял, соединение не открылось
      await tick();
      expect([link.state, link.attempts]).toEqual(["offline", 1]);
      sockets[1]!.onclose?.();
      await tickMany();
      // третья попытка настоящая: открылась, hello принят
      expect([link.state, link.attempts, link.problem]).toEqual(["connected", 0, undefined]);
      expect(changes).toContain("offline");
      link.stop();
    });

    test("сервер ответил отказом на hello: нет связи и причина; в состояние «подключено» не переходит", async() => {
      const socket = { onopen: null, onmessage: null, onclose: null, onerror: null, close() {}, send(text: string) {
        const message = JSON.parse(text);
        queueMicrotask(() => socket.onmessage?.({ data: JSON.stringify({ t: "error", n: message.n, reason: "version" }) }));
      } } as unknown as SocketLike;
      queueMicrotask(() => socket.onopen?.());
      const link = new BafiaLink({ url: "ws://test", key: KEY, createSocket: () => socket });
      link.start();
      await tickMany();
      expect([link.state, link.problem, link.isReady]).toEqual(["offline", "version", false]);
      link.stop();
      expect([link.state, link.problem]).toEqual(["connecting", undefined]);   // после stop состояние начинается заново
    });

    test("Bafia отдаёт состояние для настроек", async() => {
      const data = { bafia: { enabled: false, asked: true, key: "k".repeat(24), code: "", color: "gold", favorites: [] } };
      const settings = new class extends Events<{ change: () => void }> {
        data = data;
        update(change: (value: typeof data) => void) { change(data); this.emit("change"); }
      }();
      const user = Object.assign(new Events<{ change: () => void }>(), { playerObjectId: "me", username: "Я" });
      const bafia = new Bafia({ settings, user, url: "ws://test", createSocket: serverSocket([], []).create });
      await tickMany();
      expect(bafia.status).toEqual({ state: "connected", attempts: 0, problem: undefined });
      bafia.dispose();
    });
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
    const data = { bafia: { enabled: false, asked: false, key: "", code: "", color: "gold", favorites: [] } };
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

  test("без согласия работает только «кто играет» (ник, id, партии, id видимых игроков); с согласием добавляются ники других, гифки и история ников", async() => {
    const { bafia, user, log, server, data } = setup();
    // ключ создаётся сам, но пока игрок не назван, на сервер ничего не уходит
    await tick();
    expect(data.bafia.key).toHaveLength(48);
    expect(data.bafia.enabled).toBe(false);

    user.playerObjectId = "p1";
    user.username = "Euaek";
    user.emit("change");
    await tick();
    expect(server.sockets).toHaveLength(1);
    expect(log.map(message => message.t)).toEqual(["hello", "presence"]);
    expect(log[1]).toMatchObject({ id: "p1", nick: "Euaek", platform: expect.stringMatching(/^(ios|android|windows|macos|linux|other)$/), version: versionNumber });

    log.length = 0;
    bafia.watch([{ id: "p2", nick: "Друг" }]);
    bafia.played(true);
    await tick();
    expect(log.map(message => message.t)).toEqual(["who", "played"]);   // ников других игроков (seen) нет
    expect(log[0]).toEqual({ n: expect.any(Number), t: "who", ids: ["p2"] });

    // остальное без согласия не работает и ничего не отправляет
    log.length = 0;
    expect(await bafia.nicks("p2")).toBeUndefined();
    expect(await bafia.gif("cat")).toBeUndefined();
    expect(await bafia.gifs("", "bafia")).toBeUndefined();
    expect(await bafia.setAvatar(new Uint8Array(30))).toEqual({ error: "offline" });
    expect(log).toEqual([]);

    bafia.setEnabled(true);
    log.length = 0;
    bafia.watch([{ id: "p3", nick: "Третий" }]);
    await tick();
    expect(log.map(message => message.t)).toEqual(["seen", "who", "marks"]);
    expect(await bafia.nicks("p2")).toEqual([{ nick: "Старый", first: 1, last: 2 }]);

    bafia.setEnabled(false);
    log.length = 0;
    expect(await bafia.nicks("p2")).toBeUndefined();
    bafia.played(false);
    await tick();
    expect(log.map(message => message.t)).toEqual(["played"]);
    bafia.dispose();
  });

  test("адрес аватарки: у игрока из Бафии, своя тоже; премиум не нужен; без согласия нет ничего", async() => {
    const data = { bafia: { enabled: true, asked: true, key: "k".repeat(24), code: "BAF-GOOD-CODE", color: "gold", favorites: [] } };
    const settings = new class extends Events<{ change: () => void }> {
      data = data;
      update(change: (value: typeof data) => void) { change(data); this.emit("change"); }
    }();
    const user = Object.assign(new Events<{ change: () => void }>(), { playerObjectId: "me", username: "Я" });
    const bafia = new Bafia({ settings, user, url: "wss://bafia.example.com", createSocket: serverSocket(["pp", "p9"], []).create });
    await tick();

    expect(bafia.avatar("pp")).toBeUndefined();   // ещё не спрашивали, кто в Бафии
    bafia.watch([{ id: "pp", nick: "Премиум" }, { id: "p9", nick: "Обычный" }]);
    await tick();
    expect(bafia.avatar("pp")).toBe("https://bafia.example.com/a/abcdef12");
    expect(bafia.avatar("p9")).toBeUndefined();
    expect(bafia.avatar("pp", true)).toBe("https://bafia.example.com/a/abcdef12/t");   // превью для чата и списков

    expect(bafia.myAvatarUrl).toBeUndefined();
    expect(await bafia.setAvatar(new Uint8Array([71, 73, 70, 56, 57, 97, 1]))).toEqual({ ok: true });
    expect(bafia.myAvatarUrl).toBe("https://bafia.example.com/a/newavatar");
    expect(await bafia.clearAvatar()).toBe(true);
    expect(bafia.myAvatarUrl).toBeUndefined();

    bafia.setEnabled(false);
    expect(bafia.avatar("pp")).toBeUndefined();
    bafia.dispose();
  });

  describe("избранные гифки", () => {
    function favoritesSetup(enabled = true) {
      const data = { bafia: { enabled, asked: true, key: "k".repeat(24), code: "", color: "gold", favorites: [] as { id: string, title: string }[] } };
      const settings = new class extends Events<{ change: () => void }> {
        data = data;
        update(change: (value: typeof data) => void) { change(data); this.emit("change"); }
      }();
      const user = Object.assign(new Events<{ change: () => void }>(), { playerObjectId: "me", username: "Я" });
      const log: Record<string, unknown>[] = [];
      const bafia = new Bafia({ settings, user, url: "ws://test", createSocket: serverSocket([], log).create });
      return { bafia, data, log };
    }

    test("добавить и убрать: новые первыми, повтор убирает, лишнее и битые номера отбрасываются, список ограничен", async() => {
      const { bafia, data } = favoritesSetup();
      const changes: number[] = [];
      bafia.on("change", () => changes.push(1));
      expect(bafia.toggleFavorite("g_aaaaa", "Кот")).toBe(true);
      expect(bafia.toggleFavorite("abc123", "Пёс")).toBe(true);
      expect(bafia.favorites.map(item => item.id)).toEqual(["abc123", "g_aaaaa"]);
      expect(bafia.isFavorite("g_aaaaa")).toBe(true);
      expect(bafia.toggleFavorite("g_aaaaa")).toBe(false);
      expect(bafia.favorites.map(item => item.id)).toEqual(["abc123"]);
      expect(changes.length).toBeGreaterThanOrEqual(3);
      expect(bafia.toggleFavorite("плохой номер!", "x")).toBe(false);
      expect(data.bafia.favorites).toHaveLength(1);

      for(let i = 0; i < FAVORITES_MAX + 20; i++) bafia.toggleFavorite("n" + i);
      expect(bafia.favorites).toHaveLength(FAVORITES_MAX);
      expect(bafia.favorites[0]!.id).toBe("n" + (FAVORITES_MAX + 19));   // самые новые остались

      // повреждённые данные из файла настроек не ломают список
      data.bafia.favorites = [{ id: "ok1234", title: "норм" }, { id: 5 as never, title: "x" }, null as never, { id: "bad id", title: "x" }];
      expect(bafia.favorites.map(item => item.id)).toEqual(["ok1234"]);
    });

    test("вкладка «Избранное»: гифки Giphy собираются без сервера, исчезнувшие из каталога пропускаются, по названию можно искать, без согласия пусто", async() => {
      const { bafia, data, log } = favoritesSetup();
      await tick();
      bafia.toggleFavorite("cat", "Кот в шляпе");        // в каталоге сервера есть (в тестовом сервере кот отвечает)
      bafia.toggleFavorite("gone", "Пропала");            // каталог о такой не знает
      bafia.toggleFavorite("g_ICOgUNjpvO0PC", "Привет");
      log.length = 0;
      const all = await bafia.gifs("", "favorites");
      expect(all?.map(item => item.id)).toEqual(["g_ICOgUNjpvO0PC", "cat"]);
      expect(all?.[0]!.url).toBe("https://media.giphy.com/media/ICOgUNjpvO0PC/200w.gif");
      expect(all?.[0]!.title).toBe("Привет");             // название берётся из сохранённого
      expect(log.some(message => message.t == "gif" && message.id == "g_ICOgUNjpvO0PC")).toBe(false);

      expect((await bafia.gifs("шляп", "favorites"))?.map(item => item.id)).toEqual(["cat"]);
      expect(await bafia.gifs("нет такого", "favorites")).toEqual([]);

      data.bafia.enabled = false;
      expect(await bafia.gifs("", "favorites")).toBeUndefined();
    });
  });

  test("экономия ресурсов: аватарки везде статичные превью, даже там, где обычно играет анимация", async() => {
    const data = { bafia: { enabled: true, asked: true, key: "k".repeat(24), code: "BAF-GOOD-CODE", color: "gold", favorites: [] }, lowPower: false };
    const settings = new class extends Events<{ change: () => void }> {
      data = data;
      update(change: (value: typeof data) => void) { change(data); this.emit("change"); }
    }();
    const user = Object.assign(new Events<{ change: () => void }>(), { playerObjectId: "me", username: "Я" });
    const bafia = new Bafia({ settings, user, url: "wss://bafia.example.com", createSocket: serverSocket(["pp"], []).create });
    await tick();
    bafia.watch([{ id: "pp", nick: "Премиум" }]);
    await tick();
    expect(bafia.avatar("pp")).toBe("https://bafia.example.com/a/abcdef12");        // обычно полная анимация
    data.lowPower = true;
    expect(bafia.avatar("pp")).toBe("https://bafia.example.com/a/abcdef12/t");      // при экономии - превью
    bafia.dispose();
  });

  test("ключи случайные", () => {
    expect(newKey()).not.toBe(newKey());
  });
});
