import { describe, expect, test } from "bun:test";
import { Connection, ServerClient } from "@common/net";
import { createFakeNetwork, instantDelay } from "@common/net/testing";
import { MemoryFileStore } from "@common/storage";
import { ThemeManager } from "@common/ui/theme";
import { generateAuthorKey, hashText, keyId, parseManifest, signMod, type ModPackage } from "@mods/index";
import { spawnInProcess } from "./testing";
import { Navigator } from "@common/ui/nav/navigator";
import { User } from "../domain/user";
import type { Routes } from "../routes";
import { ModManager } from "./manager";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

/** мод для теста: тело функции становится кодом мода */
const pack = (code: (mod: any) => void, permissions: string[]) =>
  ({ manifest: parseManifest({ id: "demo", name: "Демо", version: "1.0.0", permissions }), code: `(${code})(globalThis.mod)` });

async function setup(files = new MemoryFileStore(), fetchText?: (url: string) => Promise<string>, builtIn: ModPackage[] = [], extra: Partial<ConstructorParameters<typeof ModManager>[0]> = {}) {
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
    actions: { enterRoom: id => { notes.push("enter " + id); }, waitAndJoin: id => { notes.push("wait " + id); }, rehostRoom: async() => { notes.push("rehost"); }, rehostListed: async id => { notes.push("rehost " + id); }, openProfile: id => { notes.push("profile " + id); } },
    builtIn,
    spawn: spawnInProcess,
    ...extra
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

  describe("доверие: подпись автора и список проверенных", () => {
    const author = (name = "Автор") => { const user = new User(); user.username = name; return user; };
    const signedPack = async(key: Awaited<ReturnType<typeof generateAuthorKey>>, code = "(globalThis.mod.notify('жив'))", nick = "Автор"): Promise<ModPackage> => {
      const manifest = parseManifest({ id: "demo", name: "Демо", version: "1.0.0", author: nick, permissions: ["notify"] });
      return { manifest, code, signature: await signMod(manifest, code, key) };
    };
    const registryOf = (extra: Record<string, unknown> = {}) => async() => JSON.stringify({ approved: [], blocked: [], authors: { trusted: [], blocked: [] }, ...extra });
    const URL = "https://bafia.test/mods/registry.json";

    test("без подписи и без списка мод «не подписан»; с подписью - «подписан»; подпись переживает перезапуск, а подмена кода её ломает", async() => {
      const files = new MemoryFileStore();
      const key = await generateAuthorKey();
      const { manager } = await setup(files, registryOf(), [], { registryUrl: URL });
      await manager.install(pack(() => {}, ["notify"]), true);
      expect(manager.list[0]!.trust).toEqual({ level: "unsigned" });

      await manager.install(await signedPack(key), true);
      expect(manager.list[0]!.trust).toEqual({ level: "signed", nick: "Автор" });

      const again = await setup(files, registryOf(), [], { registryUrl: URL });
      expect(again.manager.list[0]!.trust).toEqual({ level: "signed", nick: "Автор" });

      const stored = JSON.parse((await files.read("/mods/installed.json"))!);
      stored.mods[0].code += " // подмена";
      await files.write("/mods/installed.json", JSON.stringify(stored));
      const tampered = await setup(files, registryOf(), [], { registryUrl: URL });
      expect(tampered.manager.list[0]!.trust).toEqual({ level: "invalid" });
    });

    test("проверенная версия и проверенный автор берутся из списка сервера", async() => {
      const key = await generateAuthorKey();
      const signed = await signedPack(key);
      const sha = await hashText(signed.code);
      const approved = await setup(new MemoryFileStore(), registryOf({ approved: [sha] }), [], { registryUrl: URL });
      await approved.manager.install(signed, true);
      await approved.manager.refreshRegistry();
      expect(approved.manager.list[0]!.trust).toEqual({ level: "verified" });

      const trusted = await setup(new MemoryFileStore(), registryOf({ authors: { trusted: [{ id: await keyId(key.publicKey), nick: "Автор" }], blocked: [] } }), [], { registryUrl: URL });
      await trusted.manager.install(await signedPack(key, "(globalThis.mod.notify('новая версия'))"), true);
      await trusted.manager.refreshRegistry();
      expect(trusted.manager.list[0]!.trust).toEqual({ level: "author", nick: "Автор" });
    });

    test("запрещённый мод отключается сразу с уведомлением, включить его нельзя, установить тоже; список недоступен - ничего не ломается", async() => {
      const key = await generateAuthorKey();
      const signed = await signedPack(key);
      const sha = await hashText(signed.code);
      let registry: () => Promise<string> = registryOf();
      const { manager, notes } = await setup(new MemoryFileStore(), () => registry(), [], { registryUrl: URL });
      await manager.install(signed, true);
      await manager.setEnabled("demo", true);
      await tick(); await tick();
      expect(manager.list[0]).toMatchObject({ status: "running" });

      registry = async() => { throw new Error("нет сети"); };
      await manager.refreshRegistry();
      expect(manager.list[0]).toMatchObject({ status: "running" });          // списка нет: мод остаётся как был

      registry = registryOf({ blocked: [{ hash: sha, note: "вредный" }] });
      await manager.refreshRegistry();
      expect(manager.find("demo")!.enabled).toBe(false);
      expect(manager.list[0]).toMatchObject({ status: "stopped", trust: { level: "blocked", reason: "вредный" } });
      expect(notes.some(note => note.includes("Мод «Демо» отключён") && note.includes("Запрещён Бафией: вредный"))).toBe(true);
      await manager.refreshRegistry();
      expect(notes.filter(note => note.includes("отключён"))).toHaveLength(1);   // уведомление один раз
      await expect(manager.setEnabled("demo", true)).rejects.toThrow("Запрещён Бафией");
      await expect(manager.install(signed, true)).rejects.toThrow("Запрещён Бафией");
    });

    test("запрещённый автор: все его моды отключаются, даже новые версии", async() => {
      const key = await generateAuthorKey();
      const { manager } = await setup(new MemoryFileStore(), registryOf({ authors: { trusted: [], blocked: [{ id: await keyId(key.publicKey), note: "спам" }] } }), [], { registryUrl: URL });
      await manager.refreshRegistry();
      await expect(manager.install(await signedPack(key, "(1)"), true)).rejects.toThrow("Запрещён Бафией: спам");
    });

    test("на проверку отправляет только подписавший автор с ником игрока; отправляется манифест, код, исходники и подпись; проверенному не нужно", async() => {
      const key = await generateAuthorKey();
      const sent: ModPackage[] = [];
      const submitMod = async(pack: ModPackage) => { sent.push(pack); return { ok: true } as const };
      const mine = await setup(new MemoryFileStore(), registryOf(), [], { registryUrl: URL, user: author("автор"), submitMod });
      await mine.manager.install(await signedPack(key), true);
      expect(mine.manager.list[0]!.canSubmit).toBe(true);
      expect(await mine.manager.submitForReview("demo")).toEqual({ ok: true });
      expect(sent[0]).toMatchObject({ manifest: { id: "demo", author: "Автор" }, code: "(globalThis.mod.notify('жив'))", signature: { key: key.publicKey } });

      const stranger = await setup(new MemoryFileStore(), registryOf(), [], { registryUrl: URL, user: author("Чужой"), submitMod });
      await stranger.manager.install(await signedPack(key), true);
      expect(stranger.manager.list[0]!.canSubmit).toBe(false);
      expect(await stranger.manager.submitForReview("demo")).toEqual({ error: "not-allowed" });

      const unsigned = await setup(new MemoryFileStore(), registryOf(), [], { registryUrl: URL, user: author("Автор"), submitMod });
      await unsigned.manager.install(pack(() => {}, ["notify"]), true);
      expect(unsigned.manager.list[0]!.canSubmit).toBe(false);

      const signed = await signedPack(key);
      const verified = await setup(new MemoryFileStore(), registryOf({ approved: [await hashText(signed.code)] }), [], { registryUrl: URL, user: author("Автор"), submitMod });
      await verified.manager.install(signed, true);
      await verified.manager.refreshRegistry();
      expect(verified.manager.list[0]!.canSubmit).toBe(false);
    });
  });
});
