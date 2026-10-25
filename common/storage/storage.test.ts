import "fake-indexeddb/auto";
import { beforeEach, describe, expect, test } from "bun:test";
import { Accounts, IdbFileStore, JsonDocument, MemoryFileStore, createStorage, importFromLegacy, migrateOnFirstRun } from ".";
import { openDatabase } from "./idb";

const legacyProfiles = await Bun.file(new URL("../../tests/fixtures/legacy-profiles.json", import.meta.url)).text();

/** база ровно такая, какой её создавала и наполняла старая версия (legacy/core/src/fs/indexeddb.ts) */
async function createLegacyDatabase(name: string, files: Record<string, string>) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("Storage");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transaction = db.transaction("Storage", "readwrite");
  transaction.objectStore("Storage").put({ type: "dir" }, "/game");
  for(const [path, text] of Object.entries(files)) {
    transaction.objectStore("Storage").put({ type: "file", content: new Blob([text]), createdAt: 1, modifiedAt: 2, sha1: "abc" }, path);
  }
  await new Promise(resolve => transaction.oncomplete = resolve);
  db.close();
}

let dbCounter = 0;
const freshName = () => `test-${dbCounter++}`;

describe("старые данные игроков", () => {
  test("аккаунты из базы старой версии читаются без потерь", async() => {
    const name = freshName();
    await createLegacyDatabase(name, { "/profiles.json": legacyProfiles });

    const accounts = new Accounts(new IdbFileStore(await openDatabase(indexedDB, name)));
    const list = await accounts.list();

    expect(list.map(account => account.name)).toEqual(["Euaek", "OldFormat", ""]);
    expect(list[0]).toMatchObject({ email: "a@b.c", password: "md5hash", token: "tok-1", userId: "uo-1", playerUserId: "p-1", photo: "ph1" });
    expect(list[1]!.version).toBe(1);
    expect(list[2]).toMatchObject({ needUpdate: true, futureField: { x: 1 } });
  });

  test("открытие базы не меняет её схему", async() => {
    const name = freshName();
    await createLegacyDatabase(name, { "/profiles.json": legacyProfiles });

    const db = await openDatabase(indexedDB, name);
    expect(db.version).toBe(1);
    expect([...db.objectStoreNames]).toEqual(["Storage"]);
  });

  test("запись новой версией остаётся читаемой старой (Blob, type: file)", async() => {
    const name = freshName();
    await createLegacyDatabase(name, { "/profiles.json": legacyProfiles });
    const db = await openDatabase(indexedDB, name);

    await new Accounts(new IdbFileStore(db)).upsert({ name: "New", userId: "uo-9", token: "tok-9" });

    const entry = await new Promise<any>(resolve => {
      const request = db.transaction("Storage").objectStore("Storage").get("/profiles.json");
      request.onsuccess = () => resolve(request.result);
    });
    expect(entry.type).toBe("file");
    expect(entry.content).toBeInstanceOf(Blob);
    expect(entry.createdAt).toBe(1);
    const saved = JSON.parse(await entry.content.text());
    expect(saved).toHaveLength(4);
    expect(saved.at(-1)).toMatchObject({ name: "New", version: 1 });
  });
});

describe("очистка", () => {
  test("clear стирает только данные Бафии, чужие базы того же сайта не трогает", async() => {
    const name = freshName();
    await createLegacyDatabase(name, { "/profiles.json": legacyProfiles });
    await createLegacyDatabase("чужой-проект", { "/данные.json": "не трогать" });

    const mine = new IdbFileStore(await openDatabase(indexedDB, name));
    await mine.clear();
    expect(await mine.list("/")).toEqual([]);

    const other = new IdbFileStore(await openDatabase(indexedDB, "чужой-проект"));
    expect(await other.read("/данные.json")).toBe("не трогать");
  });
});

describe("аккаунты", () => {
  let accounts: Accounts;
  beforeEach(() => { accounts = createStorage(new MemoryFileStore()).accounts; });

  test("аккаунты без токена не склеиваются между собой (в старом коде undefined == undefined)", async() => {
    await accounts.upsert({ name: "A", email: "a@a" });
    await accounts.upsert({ name: "B", email: "b@b" });
    expect(await accounts.list()).toHaveLength(2);
  });

  test("повторный вход по токену не стирает email и пароль", async() => {
    await accounts.upsert({ name: "A", email: "a@a", password: "hash", userId: "u1", token: "t1" });
    const { created } = await accounts.upsert({ userId: "u1", token: "t2" });

    expect(created).toBe(false);
    expect(await accounts.list()).toEqual([expect.objectContaining({ name: "A", email: "a@a", password: "hash", token: "t2" })]);
  });

  test("параллельные изменения не теряются", async() => {
    await Promise.all(Array.from({ length: 10 }, (_, i) => accounts.upsert({ name: `acc${i}`, userId: `u${i}` })));
    expect(await accounts.list()).toHaveLength(10);
  });

  test("экспорт и импорт возвращают те же аккаунты", async() => {
    await accounts.upsert({ name: "A", userId: "u1", token: "t1" });
    const json = await accounts.exportJson();

    const other = createStorage(new MemoryFileStore()).accounts;
    expect(await other.importJson(json)).toBe(1);
    expect(await other.list()).toEqual(await accounts.list());
    expect(other.importJson("{}")).rejects.toThrow("не файл экспорта");
  });
});

describe("JsonDocument", () => {
  test("испорченный файл не затирается молча, а сохраняется копией", async() => {
    const files = new MemoryFileStore();
    await files.write("/profiles.json", "{ сломанный json");

    expect(await new Accounts(files).list()).toEqual([]);
    const backups = (await files.list("/")).filter(name => name.startsWith("profiles.json.corrupt-"));
    expect(backups).toHaveLength(1);
    expect(await files.read(`/${backups[0]}`)).toBe("{ сломанный json");
  });

  test("настройки из старой версии получают недостающие поля", async() => {
    const files = new MemoryFileStore();
    await files.write("/game/settings.json", JSON.stringify({ version: 5, debug: true, game: { widthPL: 200 } }));

    const settings = await createStorage(files).settings.read();
    expect(settings).toMatchObject({ version: 6, debug: true, game: { widthPL: 200, showIndexPl: false, barmanEffect: "!" } });
    expect(settings.roomCreate.selectedRoles).toHaveLength(8);
  });

  test("масштаб 0.6 из старой версии на телефоне заменяется обычным, свой выбор не трогается", async() => {
    const files = new MemoryFileStore();
    await files.write("/game/settings.json", JSON.stringify({ window: { zoom: .6 } }));
    expect((await createStorage(files, true).settings.read()).window.zoom).toBe(1);
    expect((await createStorage(files, false).settings.read()).window.zoom).toBe(.6);

    await files.write("/game/settings.json", JSON.stringify({ window: { zoom: 1.3 } }));
    expect((await createStorage(files, true).settings.read()).window.zoom).toBe(1.3);
    expect((await createStorage(new MemoryFileStore(), true).settings.read()).window.zoom).toBe(1);
  });

  test("тип JsonDocument подхватывает миграцию", async() => {
    const files = new MemoryFileStore();
    await files.write("/x.json", "5");
    const doc = new JsonDocument<number>(files, { path: "/x.json", defaults: () => 0, migrate: raw => Number(raw) * 2 });
    expect(await doc.read()).toBe(10);
  });
});

describe("перенос из старой версии", () => {
  const legacyFiles = {
    "/profiles.json": legacyProfiles,
    "/options.json": JSON.stringify({ profile: "uo-1", images: ["assets"], windowsInFS: true }),
    "/game/settings.json": JSON.stringify({ version: 6, debug: true })
  };

  async function setupMigration() {
    const legacyName = freshName();
    await createLegacyDatabase(legacyName, legacyFiles);
    const files = new MemoryFileStore();
    return { legacyName, files, accounts: new Accounts(files) };
  }

  test("аккаунты и настройки переезжают при первом запуске", async() => {
    const { legacyName, files, accounts } = await setupMigration();

    const result = await migrateOnFirstRun(files, accounts, { name: legacyName });

    expect(result).toMatchObject({ accounts: 3, noLegacy: false });
    expect((await accounts.list()).map(account => account.name)).toEqual(["Euaek", "OldFormat", ""]);
    expect(JSON.parse((await files.read("/options.json"))!)).toMatchObject({ windowsInFS: true, images: ["assets"] });
    expect(JSON.parse((await files.read("/game/settings.json"))!).debug).toBe(true);
  });

  test("старая база не меняется", async() => {
    const { legacyName, files, accounts } = await setupMigration();
    await migrateOnFirstRun(files, accounts, { name: legacyName });
    await accounts.upsert({ name: "Новый", userId: "uo-new" });

    const legacy = new IdbFileStore(await openDatabase(indexedDB, legacyName));
    expect(await legacy.read("/profiles.json")).toBe(legacyProfiles);
    expect((await legacy.list("/")).sort()).toEqual(["game", "options.json", "profiles.json"]);
  });

  test("если старой базы нет, она не создаётся", async() => {
    const files = new MemoryFileStore();
    const result = await migrateOnFirstRun(files, new Accounts(files), { name: "нет-такой-базы" });

    expect(result).toMatchObject({ noLegacy: true, accounts: 0 });
    expect((await indexedDB.databases()).map(db => db.name)).not.toContain("нет-такой-базы");
  });

  test("автоперенос один раз: удалённый игроком аккаунт не возвращается, ручной импорт возвращает", async() => {
    const { legacyName, files, accounts } = await setupMigration();
    await migrateOnFirstRun(files, accounts, { name: legacyName });
    await accounts.remove(account => account.name == "Euaek");

    expect(await migrateOnFirstRun(files, accounts, { name: legacyName })).toBeUndefined();
    expect((await accounts.list()).map(account => account.name)).not.toContain("Euaek");

    await importFromLegacy(files, accounts, { name: legacyName });
    expect((await accounts.list()).map(account => account.name)).toContain("Euaek");
  });

  test("настройки, уже заданные в новой версии, не затираются", async() => {
    const { legacyName, files, accounts } = await setupMigration();
    await files.write("/options.json", JSON.stringify({ windowsInFS: false }));

    const result = await migrateOnFirstRun(files, accounts, { name: legacyName });

    expect(result?.copied).not.toContain("/options.json");
    expect(JSON.parse((await files.read("/options.json"))!)).toEqual({ windowsInFS: false });
  });
});
