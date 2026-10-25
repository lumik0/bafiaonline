import { describe, expect, test } from "bun:test";
import { checkForUpdate, downloadUpdate, hashText, isNewer, parseManifest, parseUpdateInfo } from ".";

const manifest = parseManifest({ id: "my-mod", name: "Мой", version: "1.2.0", updateUrl: "https://mods.example.com/my/update.json" });
const file = (version = "1.3.0", extra: object = {}) => JSON.stringify({ manifest: { id: "my-mod", name: "Мой", version, updateUrl: manifest.updateUrl, ...extra }, code: "mod.log(1)" });
const serve = (files: Record<string, string>) => async(url: string) => {
  if(!(url in files)) throw new Error("404");
  return files[url]!;
};

describe("версии и хеши", () => {
  test("числовые версии сравниваются по частям, а не как строки", () => {
    expect(isNewer("1.10.0", "1.9.0")).toBe(true);
    expect(isNewer("1.2", "1.2.0")).toBe(false);
    expect(isNewer("1.1.9", "1.2.0")).toBe(false);
    expect(isNewer("beta-2", "beta-1")).toBe(true);
    expect(isNewer("1.2.0", "1.2.0")).toBe(false);
  });

  test("известные значения хешей", async() => {
    expect(await hashText("abc", "SHA-1")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(await hashText("abc", "SHA-256")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  test("updateUrl: только https", () => {
    expect(() => parseManifest({ id: "my-mod", name: "a", version: "1", updateUrl: "http://x.com/u.json" })).toThrow("updateUrl");
    expect(() => parseManifest({ id: "my-mod", name: "a", version: "1", updateUrl: "https://user:pass@x.com/u.json" })).toThrow("updateUrl");
    expect(manifest.updateUrl).toBe("https://mods.example.com/my/update.json");
  });
});

describe("описание обновления", () => {
  const url = "https://mods.example.com/my/update.json";

  test("относительный файл разворачивается, чужой сайт и отсутствие хеша отклоняются", () => {
    const sha256 = "a".repeat(64);
    expect(parseUpdateInfo({ version: "2", file: "my.json", sha256 }, url).fileUrl).toBe("https://mods.example.com/my/my.json");
    expect(() => parseUpdateInfo({ version: "2", file: "https://evil.com/my.json", sha256 }, url)).toThrow("том же сайте");
    expect(() => parseUpdateInfo({ version: "2", file: "http://mods.example.com/my.json", sha256 }, url)).toThrow("том же сайте");
    expect(() => parseUpdateInfo({ version: "2", file: "my.json" }, url)).toThrow("нет хеша");
    expect(() => parseUpdateInfo({ version: "2", file: "my.json", sha256: "xyz" }, url)).toThrow("неверно");
  });
});

describe("проверка и загрузка", () => {
  test("новая версия находится, такая же или старая - нет, без updateUrl вопросов нет", async() => {
    const sha256 = "a".repeat(64);
    const answer = (version: string) => serve({ [manifest.updateUrl!]: JSON.stringify({ version, file: "f.json", sha256 }) });
    expect((await checkForUpdate(manifest, answer("1.3.0")))?.version).toBe("1.3.0");
    expect(await checkForUpdate(manifest, answer("1.2.0"))).toBeUndefined();
    expect(await checkForUpdate(manifest, answer("1.1.0"))).toBeUndefined();
    expect(await checkForUpdate({ ...manifest, updateUrl: undefined }, async() => { throw new Error("не должно быть запроса"); })).toBeUndefined();
    await expect(checkForUpdate(manifest, serve({ [manifest.updateUrl!]: "<html>" }))).rejects.toThrow("не JSON");
  });

  test("файл с правильным хешем принимается", async() => {
    const text = file();
    const info = { version: "1.3.0", fileUrl: "https://mods.example.com/my/f.json", sha256: await hashText(text), sha1: await hashText(text, "SHA-1") };
    const pack = await downloadUpdate(manifest, info, serve({ [info.fileUrl]: text }));
    expect(pack.manifest.version).toBe("1.3.0");
  });

  test("подмена: другой хеш, другой мод, другая версия, смена updateUrl - всё отклоняется", async() => {
    const url = "https://mods.example.com/my/f.json";
    const info = async(text: string) => ({ version: "1.3.0", fileUrl: url, sha256: await hashText(text) });
    const attempt = async(served: string, expected: string) => downloadUpdate(manifest, await info(expected), serve({ [url]: served }));

    await expect(attempt(file(), file("1.3.0", { name: "Подмена" }))).rejects.toThrow("SHA-256");
    await expect(attempt(file("1.3.0", { id: "other-mod" }), file("1.3.0", { id: "other-mod" }))).rejects.toThrow("другой мод");
    await expect(attempt(file("9.9.9"), file("9.9.9"))).rejects.toThrow("Версия в файле");
    await expect(attempt(file("1.3.0", { updateUrl: "https://evil.com/u.json" }), file("1.3.0", { updateUrl: "https://evil.com/u.json" }))).rejects.toThrow("адрес обновлений");

    const sha1Wrong = { version: "1.3.0", fileUrl: url, sha256: await hashText(file()), sha1: "0".repeat(40) };
    await expect(downloadUpdate(manifest, sha1Wrong, serve({ [url]: file() }))).rejects.toThrow("SHA-1");
  });
});
