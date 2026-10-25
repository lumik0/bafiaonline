import { describe, expect, test } from "bun:test";
import { Connection, ServerClient } from "@common/net";
import { createFakeNetwork, instantDelay } from "@common/net/testing";
import { MemoryFileStore } from "@common/storage";
import { ThemeManager } from "@common/ui/theme";
import { hashText, parseManifest, type ModPackage } from "@mods/index";
import { spawnInProcess } from "./testing";
import { Navigator } from "@common/ui/nav/navigator";
import { User } from "../domain/user";
import type { Routes } from "../routes";
import { ModManager } from "./manager";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

/** мод для теста: тело функции становится кодом мода */
const pack = (code: (mod: any) => void, permissions: string[]) =>
  ({ manifest: parseManifest({ id: "demo", name: "Демо", version: "1.0.0", permissions }), code: `(${code})(globalThis.mod)` });

async function setup(files = new MemoryFileStore(), fetchText?: (url: string) => Promise<string>, builtIn: ModPackage[] = []) {
  const network = createFakeNetwork();
  const client = new ServerClient(new Connection({ url: "ws://test", createSocket: () => network.createSocket(), delay: instantDelay }));
  client.connect();
  await tick();
  const notes: string[] = [];
  const themeVars = new Map<string, string>();
  const theme = new ThemeManager({ style: { setProperty: (name, value) => themeVars.set(name, value), removeProperty() {} } });
  const nav = new Navigator<Routes>();
  const manager = new ModManager({
    client, files, theme, user: new User(), nav, fetchText, notify: o => notes.push(`${o.source}: ${o.title}${o.text ? " | " + o.text : ""}`),
    alert: (title, text) => { notes.push(`${title}: ${text}`); },
    actions: { enterRoom: id => { notes.push("enter " + id); }, waitAndJoin: id => { notes.push("wait " + id); }, rehostRoom: async() => { notes.push("rehost"); }, openProfile: id => { notes.push("profile " + id); } },
    builtIn,
    spawn: spawnInProcess
  });
  await manager.start();
  return { manager, files, notes, network, theme, themeVars, nav };
}

describe("ModManager", () => {
  test("установка → включение → мод работает с теми правами, что даны", async() => {
    const { manager, notes } = await setup();
    await manager.install(pack(mod => { mod.notify("запущен"); mod.chat.send("нельзя").catch((e: Error) => mod.notify(e.message)); }, ["notify"]), true);
    expect(manager.list[0]).toMatchObject({ status: "stopped" });

    await manager.setEnabled("demo", true);
    await tick(); await tick(); await tick();
    expect(manager.list[0]!.status).toBe("running");
    expect(notes).toEqual(["Демо: запущен", "Демо: Нет разрешения chat:send"]);
  });

  test("отключение разрешения перезапускает мод и сохраняется; удаление чистит всё", async() => {
    const files = new MemoryFileStore();
    const { manager, notes } = await setup(files);
    await manager.install(pack(mod => { mod.notify("привет").catch(() => {}); }, ["notify"]), true);
    await manager.setEnabled("demo", true);
    await tick(); await tick();

    await manager.setGranted("demo", "notify", false);
    notes.length = 0;
    await tick(); await tick();
    expect(notes).toEqual([]);
    expect(manager.find("demo")!.granted).toEqual([]);

    const second = await setup(files);
    expect(second.manager.find("demo")).toMatchObject({ enabled: true, granted: [] });

    await second.manager.remove("demo");
    expect(second.manager.list).toEqual([]);
    expect(JSON.parse((await files.read("/mods/installed.json"))!).mods).toEqual([]);
  });

  test("обновление мода не включает новые разрешения само", async() => {
    const { manager } = await setup();
    await manager.install(pack(() => {}, ["notify"]), true);
    await manager.install(pack(() => {}, ["notify", "chat:send"]), false);
    expect(manager.find("demo")!.granted).toEqual(["notify"]);
  });

  test("тема от мода - временный слой и пропадает вместе с модом", async() => {
    const { manager, themeVars } = await setup();
    await manager.install(pack(mod => { mod.theme.set({ accent: "#00ff00" }); }, ["theme"]), true);
    await manager.setEnabled("demo", true);
    await tick(); await tick();
    expect(themeVars.get("--accent")).toBe("#00ff00");

    await manager.setEnabled("demo", false);
    expect(themeVars.get("--accent")).toBe("#d03a41");
  });

  test("команда «/привет» достаётся моду, обычный текст нет", async() => {
    const { manager, notes } = await setup();
    await manager.install(pack(mod => { mod.commands.register("hi", (args: string[]) => mod.notify("hi " + args.join(" "))); }, ["commands", "notify"]), true);
    await manager.setEnabled("demo", true);
    await tick(); await tick();

    expect(manager.runCommand("/hi мир")).toBe(true);
    expect(manager.runCommand("/unknown")).toBe(false);
    expect(manager.runCommand("hi")).toBe(false);
    await tick(); await tick();
    expect(notes).toEqual(["Демо: hi мир"]);
  });

  test("мод узнаёт, какой экран открыт, и не может ходить вне комнаты", async() => {
    const { manager, nav } = await setup();
    await manager.install(pack(async mod => {
      mod.on("screen:change", (e: { name: string }) => mod.log("экран " + e.name));
      mod.log("сейчас " + await mod.screen.current());
      mod.log("комната " + JSON.stringify(await mod.room.state()));
      await mod.room.vote(0).catch((e: Error) => mod.log("vote: " + e.message));
    }, ["game:read", "room:act"]), true);
    nav.push("menu");
    await manager.setEnabled("demo", true);
    await tick(); await tick(); await tick(); await tick();
    nav.push("rooms");
    await tick(); await tick();

    expect(manager.list[0]!.log).toEqual(["сейчас menu", "комната null", "vote: Ты не в комнате", "экран rooms"]);
  });

  test("токен из ответа на вход моду не уходит", async() => {
    const { manager, network } = await setup();
    await manager.install(pack(mod => { mod.on("packet", (p: { name: string }) => mod.notify(p.name)); }, ["packet:read", "notify"]), true);
    await manager.setEnabled("demo", true);
    await tick(); await tick();

    network.last.receive({ ty: "usi", usid: { u: "x", t: "СЕКРЕТ", o: "o", uo: "uo" } });
    network.last.receive({ ty: "timer", t: 5 });
    await tick(); await tick(); await tick();
    expect(manager.list[0]!.log).toEqual([]);
    expect(manager.list[0]!.status).toBe("running");
  });
});

describe("пример мода", () => {
  test("hello из mods/examples ставится и запускается", async() => {
    const { parsePackage } = await import("@mods/index");
    const { manager } = await setup();
    const pack = parsePackage(await Bun.file("mods/examples/hello/hello.bafiamod.json").text());
    await manager.install(pack, true);
    await manager.setEnabled("hello", true);
    await tick(); await tick(); await tick(); await tick();

    expect(manager.list[0]!.status).toBe("running");
    expect(manager.list[0]!.panel?.title).toBe("Привет-мод");
    expect(manager.runCommand("/hi")).toBe(true);
  });

  test("hello: кнопки панели показывают уведомления всех четырёх видов", async() => {
    const { parsePackage } = await import("@mods/index");
    const { manager, notes } = await setup();
    await manager.install(parsePackage(await Bun.file("mods/examples/hello/hello.bafiamod.json").text()), true);
    await manager.setEnabled("hello", true);
    await tick(); await tick(); await tick(); await tick();

    const buttons = manager.list[0]!.panel!.blocks.filter(block => block.type == "button").map(block => (block as { id: string }).id);
    expect(buttons).toEqual(["theme", "notify:info", "notify:success", "notify:warning", "notify:error"]);

    notes.length = 0;
    manager.panelAction("hello", "notify:warning");
    await tick(); await tick();
    expect(notes).toEqual(["Привет: Внимание | Что-то пошло не так, но игра продолжается."]);
  });
});

describe("обновления модов", () => {
  const updateUrl = "https://mods.example.com/u.json";
  const make = (version: string, permissions: string[]) => ({ manifest: parseManifest({ id: "demo", name: "Демо", version, permissions, updateUrl }), code: "mod.log(1)" });

  test("проверка → скачивание → установка: настройки сохраняются, новые права выключены", async() => {
    const next = make("1.1.0", ["notify", "chat:send"]);
    const text = JSON.stringify(next);
    const web: Record<string, string> = {
      [updateUrl]: JSON.stringify({ version: "1.1.0", file: "demo.json", sha256: await hashText(text) }),
      "https://mods.example.com/demo.json": text
    };
    const { manager } = await setup(new MemoryFileStore(), async url => web[url] ?? Promise.reject(new Error("404")));

    await manager.install(make("1.0.0", ["notify"]), true);
    expect(manager.list[0]!.mod.sha256).toMatch(/^[0-9a-f]{64}$/);
    await manager.checkUpdates();
    expect(manager.list[0]!.update?.version).toBe("1.1.0");

    const pack = await manager.prepareUpdate("demo");
    await manager.install(pack, false);
    expect(manager.find("demo")).toMatchObject({ granted: ["notify"] });
    expect(manager.find("demo")!.manifest.version).toBe("1.1.0");
    expect(manager.list[0]!.update).toBeUndefined();
  });

  test("ошибки проверки показываются у мода, остальные моды не страдают", async() => {
    const { manager } = await setup(new MemoryFileStore(), async() => "не json");
    await manager.install(make("1.0.0", []), true);
    await manager.checkUpdates();
    expect(manager.list[0]!.updateError).toContain("не JSON");
    await expect(manager.prepareUpdate("demo")).rejects.toThrow("Обновления нет");
  });
});
