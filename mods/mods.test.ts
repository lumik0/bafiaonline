import { describe, expect, test } from "bun:test";
import { ModRuntime, parseManifest, parsePackage, type ModBackend, type WorkerLike } from ".";
import { highestRisk, permissions, methodPermissions, eventPermissions } from "./permissions";
import { workerMain } from "./runtime";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

/** воркер без потоков: код мода работает с настоящим `workerMain`, только `self` - обычный объект */
function fakeWorker(run: (mod: any) => void, granted: string[] = []): WorkerLike {
  const scope: any = {};
  const worker: WorkerLike = {
    onmessage: null, onerror: null,
    postMessage: message => queueMicrotask(() => scope.onmessage({ data: message })),
    terminate: () => { scope.onmessage = () => {}; }
  };
  scope.postMessage = (message: unknown) => queueMicrotask(() => worker.onmessage?.({ data: message }));
  workerMain(scope, granted);
  run(scope.mod);
  return worker;
}

function setup(run: (mod: any) => void, granted: string[], manifest: Partial<ReturnType<typeof parseManifest>> = {}, callLimit?: number) {
  const calls: unknown[][] = [];
  const store = new Map<string, unknown>();
  const backend: ModBackend = {
    chatSend: text => { calls.push(["chat", text]); },
    roomSay: text => { calls.push(["say", text]); },
    screenCurrent: () => "room",
    roomPlayers: () => [{ index: 0, username: "Аня" }],
    roomState: () => ({ phase: "game" }),
    roomAct: index => { calls.push(["act", index]); },
    roomVote: index => { calls.push(["vote", index]); },
    roomGiveUp: () => { calls.push(["giveUp"]); },
    roomVoteKick: vote => { calls.push(["voteKick", vote]); },
    roomRehost: async() => { calls.push(["rehost"]); },
    profileOpen: id => { calls.push(["profile", id]); },
    accountInfo: () => ({ username: "Euaek" }),
    notify: (name, text, options) => { calls.push(["notify", name, text, options]); },
    themeSet: (id, values) => { calls.push(["theme", id, values]); },
    themeClear: () => {},
    fetchText: async url => "ответ " + url,
    roomsEnter: id => { calls.push(["enter", id]); },
    roomsWaitAndJoin: id => { calls.push(["wait", id]); },
    clipboardWrite: async text => { calls.push(["copy", text]); },
    uiDialog: (name, title, text) => { calls.push(["dialog", name, title, text]); }
  };
  const runtime = new ModRuntime({
    manifest: { id: "demo", name: "Демо", version: "1", permissions: granted as never, domains: [], ...manifest },
    granted: new Set(granted as never),
    backend,
    storage: { get: key => store.get(key), set: (key, value) => { store.set(key, value); }, remove: key => { store.delete(key); } },
    spawn: () => fakeWorker(run, granted),
    callLimit
  });
  runtime.start();
  return { runtime, calls, store };
}

describe("манифест", () => {
  test("правильный манифест читается, мусор отклоняется", () => {
    const manifest = parseManifest({ id: "my-mod", name: "Мой", version: "1.0.0", permissions: ["chat:read", "chat:read", "theme"], domains: ["API.example.com"] });
    expect(manifest.permissions).toEqual(["chat:read", "theme"]);
    expect(manifest.domains).toEqual(["api.example.com"]);

    expect(() => parseManifest({ id: "X", name: "a", version: "1" })).toThrow("id мода");
    expect(() => parseManifest({ id: "my-mod", name: "a", version: "1", permissions: ["root"] })).toThrow("Неизвестные разрешения: root");
    expect(() => parseManifest({ id: "my-mod", name: "a", version: "1", domains: ["a b"] })).toThrow("domains");
    const sources = (value: unknown) => JSON.stringify({ manifest: { id: "my-mod", name: "a", version: "1" }, code: "x", sources: value });
    expect(parsePackage(sources({ "index.ts": "let a" })).sources).toEqual({ "index.ts": "let a" });
    expect(parsePackage(sources({})).sources).toBeUndefined();
    for(const bad of [{ "../x.ts": "a" }, { "/etc": "a" }, { "a.ts": 5 }, ["a"]]) expect(() => parsePackage(sources(bad))).toThrow("sources");
    expect(() => parsePackage("не json")).toThrow("не JSON");
    expect(() => parsePackage(JSON.stringify({ manifest: { id: "my-mod", name: "a", version: "1" }, code: "" }))).toThrow("нет кода");
  });

  test("у каждого метода и события есть разрешение, самые опасные - критичные", () => {
    for(const permission of [...Object.values(methodPermissions), ...Object.values(eventPermissions)]) expect(permissions[permission]).toBeDefined();
    expect(highestRisk(["theme", "chat:send"])).toBe("high");
    expect(highestRisk(["theme", "packet:read"])).toBe("critical");
    expect(highestRisk([])).toBe("low");
  });
});

describe("ModRuntime", () => {
  test("мод с разрешением вызывает игру и получает ответы", async() => {
    const { calls, store } = setup(async mod => {
      await mod.chat.send("привет");
      await mod.storage.set("k", { n: 1 });
      mod.log("готов", await mod.account.info());
    }, ["chat:send", "storage", "account:read"]);
    await tick(); await tick(); await tick();

    expect(calls).toEqual([["chat", "привет"]]);
    expect(store.get("k")).toEqual({ n: 1 });
  });

  test("без разрешения вызов отклоняется, и мод это видит", async() => {
    const { calls, runtime } = setup(async mod => {
      try { await mod.chat.send("спам"); } catch(error) { mod.log("отказ: " + (error as Error).message); }
    }, []);
    await tick(); await tick(); await tick();

    expect(calls).toEqual([]);
    expect(runtime.log).toEqual(["отказ: Нет разрешения chat:send"]);
  });

  test("разрешение, отключённое игроком, не действует, даже если оно в манифесте", async() => {
    const { calls } = setup(async mod => { await mod.chat.send("x").catch(() => {}); }, [], { permissions: ["chat:send"] });
    await tick(); await tick();
    expect(calls).toEqual([]);
  });

  test("события приходят только подписанным и имеющим право", async() => {
    const received: unknown[] = [];
    const { runtime } = setup(mod => {
      mod.on("chat:message", (message: unknown) => received.push(message));
      mod.on("packet", () => received.push("пакет"));
    }, ["chat:read"]);
    await tick();

    runtime.emit("chat:message", { text: "привет" });
    runtime.emit("packet", { name: "x" });
    runtime.emit("room:message", {});
    await tick();

    expect(received).toEqual([{ text: "привет" }]);
    expect(runtime.log[0]).toContain("packet:read");
  });

  test("команды: только с разрешением и только свои", async() => {
    const seen: string[][] = [];
    const { runtime } = setup(mod => mod.commands.register("hello", (args: string[]) => seen.push(args)), ["commands"]);
    await tick();

    expect(runtime.runCommand("hello", ["мир"])).toBe(true);
    expect(runtime.runCommand("other", [])).toBe(false);
    await tick();
    expect(seen).toEqual([["мир"]]);

    const denied = setup(mod => mod.commands.register("hello", () => {}), []);
    await tick();
    expect(denied.runtime.runCommand("hello", [])).toBe(false);
  });

  test("сеть: только https и только домены из манифеста", async() => {
    const answers: string[] = [];
    setup(async mod => {
      answers.push(await mod.net.fetch("https://ok.example.com/a"));
      for(const url of ["https://evil.com/", "http://ok.example.com/"]) answers.push(await mod.net.fetch(url).catch((error: Error) => error.message));
    }, ["network"], { domains: ["ok.example.com"] });
    await tick(); await tick(); await tick(); await tick(); await tick();

    expect(answers).toEqual(["ответ https://ok.example.com/a", "Домен evil.com не указан в манифесте", "Домен ok.example.com не указан в манифесте"]);
  });

  test("панель проверяется по форме и праву", async() => {
    const { runtime } = setup(mod => mod.ui.panel({ title: "Панель", blocks: [{ type: "text", text: "a" }, { type: "button", id: "go", text: "Go" }, { type: "script", text: "x" }, 5] }), ["ui:panel"]);
    await tick();
    expect(runtime.panel).toEqual({ title: "Панель", blocks: [{ type: "text", text: "a" }, { type: "button", id: "go", text: "Go" }] });

    const denied = setup(mod => mod.ui.panel({ title: "x", blocks: [] }), []);
    await tick();
    expect(denied.runtime.panel).toBeUndefined();
  });

  test("мод видит, какие разрешения включены", async() => {
    const seen: unknown[] = [];
    setup(mod => { seen.push(mod.permissions.has("notify"), mod.permissions.has("chat:send"), mod.permissions.granted); }, ["notify"]);
    await tick();
    expect(seen).toEqual([true, false, ["notify"]]);
  });

  test("меню: мод отвечает пунктами и получает выбор; без права или для чужой цели ничего нет", async() => {
    const chosen: unknown[] = [];
    const { runtime } = setup(mod => mod.menu.add("room", {
      items: (room: { id: string }) => [{ id: "join", label: "Зайти в " + room.id }, { id: "bad" }, 5, { id: "x".repeat(50), label: "длинный id" }],
      select: (id: string, room: unknown) => chosen.push([id, room])
    }), ["ui:menu"]);
    await tick();

    expect(await runtime.menuItems("room", { id: "r1" })).toEqual([{ id: "join", label: "Зайти в r1" }]);
    expect(await runtime.menuItems("player", {})).toEqual([]);
    runtime.selectMenu("room", "join", { id: "r1" });
    await tick();
    expect(chosen).toEqual([["join", { id: "r1" }]]);

    const denied = setup(mod => mod.menu.add("room", { items: () => [{ id: "a", label: "A" }] }), []);
    await tick();
    expect(await denied.runtime.menuItems("room", {})).toEqual([]);
    expect(denied.runtime.log[0]).toContain("ui:menu");
  });

  test("медленный или упавший обработчик меню не вешает игру", async() => {
    const slow = setup(mod => mod.menu.add("room", { items: () => new Promise(() => {}) }), ["ui:menu"]);
    await tick();
    const started = Date.now();
    expect(await slow.runtime.menuItems("room", {})).toEqual([]);
    expect(Date.now() - started).toBeLessThan(1500);

    const broken = setup(mod => mod.menu.add("player", { items: () => { throw new Error("сломан"); } }), ["ui:menu"]);
    await tick();
    expect(await broken.runtime.menuItems("player", {})).toEqual([]);
  });

  test("профиль: строки и кнопки проверяются; нужны оба права", async() => {
    const actions: unknown[] = [];
    const code = (mod: any) => mod.profile.section({
      rows: (profile: { name: string }) => [{ label: "Имя", value: profile.name }, { label: "Игр", value: 5, button: { id: "help", text: "?" } }, { label: "без значения" }, { value: "без подписи" }],
      action: (id: string, profile: unknown) => actions.push([id, profile])
    });
    const { runtime } = setup(code, ["ui:profile", "profile:read"]);
    await tick();
    expect(await runtime.profileRows({ name: "Аня" })).toEqual([
      { label: "Имя", value: "Аня", button: undefined },
      { label: "Игр", value: "5", button: { id: "help", text: "?" } }
    ]);
    runtime.profileAction("help", { name: "Аня" });
    await tick();
    expect(actions).toEqual([["help", { name: "Аня" }]]);

    const onlyShow = setup(code, ["ui:profile"]);
    await tick();
    expect(await onlyShow.runtime.profileRows({ name: "Аня" })).toEqual([]);
  });

  test("заход в комнату, буфер обмена и окно с текстом - каждое со своим разрешением", async() => {
    const { calls } = setup(async mod => {
      await mod.rooms.enter("r1");
      await mod.rooms.waitAndJoin("r2");
      await mod.clipboard.write("текст");
      await mod.ui.dialog({ title: "Заголовок", text: "Привет" });
      await mod.rooms.enter(5).catch(() => {});
    }, ["rooms:join", "clipboard", "ui:dialog"]);
    await tick(); await tick(); await tick(); await tick(); await tick();
    expect(calls).toEqual([["enter", "r1"], ["wait", "r2"], ["copy", "текст"], ["dialog", "Демо", "Заголовок", "Привет"]]);

    const denied = setup(async mod => { await mod.rooms.enter("r1").catch(() => {}); await mod.clipboard.write("x").catch(() => {}); }, []);
    await tick(); await tick(); await tick();
    expect(denied.calls).toEqual([]);
  });

  test("уведомление мода: текст, заголовок и вид проверяются", async() => {
    const { calls } = setup(async mod => {
      await mod.notify("просто текст");
      await mod.notify("подробности", { title: "Заголовок", kind: "success" });
      await mod.notify("мусор", { title: 5, kind: "взрыв" });
    }, ["notify"]);
    await tick(); await tick(); await tick(); await tick();
    expect(calls).toEqual([
      ["notify", "Демо", "просто текст", { title: undefined, kind: undefined }],
      ["notify", "Демо", "подробности", { title: "Заголовок", kind: "success" }],
      ["notify", "Демо", "мусор", { title: undefined, kind: undefined }]
    ]);
  });

  test("слишком частые вызовы останавливают мод", async() => {
    const { runtime } = setup(mod => { for(let i = 0; i < 20; i++) mod.log("спам"); }, [], {}, 10);
    await tick();
    expect(runtime.status).toBe("crashed");
    expect(runtime.error).toContain("слишком часто");
  });

  test("из воркера закрыты сеть и хранилища браузера", () => {
    const scope: any = { postMessage() {}, fetch: () => 1, indexedDB: {} };
    workerMain(scope);
    expect(scope.fetch).toBeUndefined();
    expect(scope.indexedDB).toBeUndefined();
  });
});
