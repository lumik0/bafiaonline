import "fake-indexeddb/auto";
import { describe, expect, test } from "bun:test";
import { IdbFileStore, MemoryFileStore } from "../storage/files";
import { openDatabase, STORE_NAME } from "../storage/idb";
import { Assets, CustomImageError } from "./assets";
import { decodePack, encodePack, fromBase64, gunzip, toBase64, type AssetFile, type AssetsMeta } from "./pack";
import { ASSETS_ROOT, syncAssets, type AssetsSource } from "./sync";

const sha1 = (data: Uint8Array) => new Bun.CryptoHasher("sha1").update(data).digest("hex");
const file = (path: string, text: string): AssetFile => {
  const data = new TextEncoder().encode(text);
  return { path, size: data.length, sha1: sha1(data), data };
};

/** источник образа, как его строит scripts/assets.ts; считает, сколько раз скачали данные */
function source(files: AssetFile[]) {
  const downloads = { meta: 0, data: 0 };
  const result: AssetsSource = {
    async meta(): Promise<AssetsMeta> { downloads.meta++; return { files: files.map(({ path, size, sha1 }) => ({ path, size, sha1 })) }; },
    async data() { downloads.data++; return toBase64(Bun.gzipSync(encodePack(files) as Uint8Array<ArrayBuffer>)); }
  };
  return { source: result, downloads };
}

describe("образ", () => {
  test("упаковка и распаковка возвращают те же файлы (в том числе с русскими путями и пустыми)", async() => {
    const files = [file("textures/a.png", "картинка"), file("textures/пусто.txt", ""), file("b/c.bin", "x".repeat(70_000))];
    const packed = toBase64(Bun.gzipSync(encodePack(files) as Uint8Array<ArrayBuffer>));

    const restored = decodePack(await gunzip(fromBase64(packed)));
    expect(restored.map(f => f.path)).toEqual(files.map(f => f.path));
    expect(restored.map(f => new TextDecoder().decode(f.data))).toEqual(files.map(f => new TextDecoder().decode(f.data)));
  });

  test("обрезанный образ - понятная ошибка, а не мусор", () => {
    const bytes = encodePack([file("a", "1234567890")]);
    expect(() => decodePack(bytes.subarray(0, bytes.length - 3))).toThrow("обрезан");
  });
});

describe("syncAssets", () => {
  test("первый запуск пишет все файлы, второй ничего не качает", async() => {
    const files = new MemoryFileStore();
    const image = source([file("textures/a.png", "A"), file("textures/b.png", "B")]);

    const first = await syncAssets(files, image.source);
    expect(first.written).toEqual(["textures/a.png", "textures/b.png"]);
    expect(await files.read(`${ASSETS_ROOT}/textures/a.png`)).toBe("A");

    const second = await syncAssets(files, image.source);
    expect(second).toEqual({ written: [], upToDate: 2 });
    expect(image.downloads).toEqual({ meta: 2, data: 1 });
  });

  test("обновляются только изменившиеся файлы", async() => {
    const files = new MemoryFileStore();
    await syncAssets(files, source([file("a", "1"), file("b", "2")]).source);

    const result = await syncAssets(files, source([file("a", "1"), file("b", "новое")]).source);
    expect(result.written).toEqual(["b"]);
    expect(await files.read(`${ASSETS_ROOT}/b`)).toBe("новое");
  });

  test("ассеты старой версии в IndexedDB считаются актуальными и не перекачиваются", async() => {
    // запись ровно в том виде, как её писала старая версия: Blob и sha1 в записи
    const db = await openDatabase(indexedDB, "legacy-assets");
    const legacy = file("textures/a.png", "из старой версии");
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ type: "file", content: new Blob([legacy.data as BlobPart]), createdAt: 1, modifiedAt: 1, sha1: legacy.sha1 }, `${ASSETS_ROOT}/textures/a.png`);
    await new Promise(resolve => transaction.oncomplete = resolve);

    const image = source([legacy]);
    const result = await syncAssets(new IdbFileStore(db), image.source);

    expect(result).toEqual({ written: [], upToDate: 1 });
    expect(image.downloads.data).toBe(0);
  });

  test("файл, записанный новой версией в IndexedDB, имеет SHA-1 как у образа", async() => {
    const db = await openDatabase(indexedDB, "new-assets");
    const files = new IdbFileStore(db);
    const entry = file("textures/a.png", "данные");

    await files.writeBytes("/x", entry.data);
    expect(await files.sha1("/x")).toBe(entry.sha1);
  });
});

describe("Assets", () => {
  const setup = async() => {
    const files = new MemoryFileStore();
    await files.writeBytes(`${ASSETS_ROOT}/textures/a.png`, new TextEncoder().encode("стандартная"));
    const revoked: string[] = [];
    let counter = 0;
    const assets = new Assets(files, {
      createUrl: (bytes, mime) => `blob:${++counter}:${mime}:${new TextDecoder().decode(bytes)}`,
      revokeUrl: url => revoked.push(url)
    });
    await assets.init();
    return { files, assets, revoked };
  };

  test("адрес приходит по событию: сначала пусто, потом готовый", async() => {
    const { assets } = await setup();
    const changed = new Promise<string>(resolve => assets.on("change", resolve));

    expect(assets.url("textures/a.png")).toBe("");
    expect(await changed).toBe("textures/a.png");
    expect(assets.url("textures/a.png")).toBe("blob:1:image/png:стандартная");
  });

  test("своя картинка заменяет стандартную, сброс возвращает; старый адрес освобождается", async() => {
    const { assets, files, revoked } = await setup();
    await assets.load("textures/a.png");

    await assets.setCustom("textures/a.png", new TextEncoder().encode("моя"), "image/png");
    expect(assets.isCustom("textures/a.png")).toBe(true);
    expect(assets.url("textures/a.png")).toContain("моя");
    expect(revoked).toHaveLength(1);

    // и после перезапуска замена на месте
    const again = new Assets(files, { createUrl: (bytes) => new TextDecoder().decode(bytes) });
    await again.init();
    expect(await again.load("textures/a.png")).toBe("моя");

    await assets.clearCustom("textures/a.png");
    expect(assets.url("textures/a.png")).toContain("стандартная");
  });

  test("не картинку и слишком большой файл не принимает", async() => {
    const { assets } = await setup();
    expect(assets.setCustom("textures/a.png", new Uint8Array(3), "text/html")).rejects.toBeInstanceOf(CustomImageError);
    expect(assets.setCustom("textures/a.png", new Uint8Array(6 * 1024 * 1024), "image/png")).rejects.toThrow("5 МБ");
  });
});
