import { describe, expect, test } from "bun:test";
import { resolveFiles, type Manifest, type OtaDeps, type OtaStore } from "./ota";

const manifest = (version: string, hashes: Record<string, string>): Manifest => ({ version, files: hashes });
const same = { "index.js": "i1", "game.js": "g1" };

/** хранилище в памяти */
function memory(initial: { manifest?: Manifest, files?: Record<string, { hash: string, blob: Blob }> } = {}) {
  const state = { manifest: initial.manifest, files: { ...initial.files } as Record<string, { hash: string, blob: Blob }> };
  const store: OtaStore = {
    file: async name => state.files[name],
    putFile: async(name, hash, blob) => { state.files[name] = { hash, blob }; },
    manifest: async() => state.manifest,
    putManifest: async value => { state.manifest = value; },
    clear: async() => { state.manifest = undefined; state.files = {}; }
  };
  return { state, store };
}

/** содержимое файла - его "хеш": так проверка скачанного проходит или нет по тексту */
function setup(options: { bundled: Manifest, remote?: Manifest | "offline", memory?: ReturnType<typeof memory>, serve?: Record<string, string> }) {
  const mem = options.memory ?? memory();
  const downloads: string[] = [];
  const deps: OtaDeps = {
    bundled: options.bundled,
    bundledUrl: name => `bundled/${name}`,
    remoteManifest: async() => { if(options.remote == "offline") throw new Error("нет сети"); return options.remote; },
    download: async name => { downloads.push(name); const body = options.serve?.[name]; if(body === undefined) throw new Error("404"); return new Blob([body]); },
    hash: async blob => await blob.text(),
    store: mem.store,
    objectUrl: blob => `blob:${blob.size}`
  };
  return { deps, mem, downloads };
}

describe("обновление без переустановки", () => {
  test("на сайте новее: скачивается только изменённое, остальное берётся из приложения; опись запоминается", async() => {
    const bundled = manifest("a1", same), remote = manifest("a2", { "index.js": "i1", "game.js": "g2" });
    const { deps, mem, downloads } = setup({ bundled, remote, serve: { "game.js": "g2" } });
    const result = await resolveFiles(deps);
    expect(result).toMatchObject({ version: "a2", source: "remote", files: { "index.js": "bundled/index.js" } });
    expect(result.files["game.js"]).toStartWith("blob:");
    expect(downloads).toEqual(["game.js"]);
    expect(mem.state.manifest).toEqual(remote);
    expect(mem.state.files["game.js"]!.hash).toBe("g2");
  });

  test("без сети берётся прошлое скачивание, второй раз ничего не качается", async() => {
    const bundled = manifest("a1", same), remote = manifest("a2", { "index.js": "i1", "game.js": "g2" });
    const first = setup({ bundled, remote, serve: { "game.js": "g2" } });
    await resolveFiles(first.deps);
    const offline = setup({ bundled, remote: "offline", memory: first.mem });
    expect(await resolveFiles(offline.deps)).toMatchObject({ version: "a2", source: "cache" });
    const again = setup({ bundled, remote, memory: first.mem });
    expect((await resolveFiles(again.deps)).source).toBe("remote");
    expect(again.downloads).toEqual([]);
  });

  test("скачалось не то (хеш не совпал) или файл не отдаётся: запускается прежняя сборка, кэш не портится", async() => {
    const bundled = manifest("a1", same), remote = manifest("a2", { "index.js": "i1", "game.js": "g2" });
    for(const serve of [{ "game.js": "обрезано" }, {}] as Record<string, string>[]) {
      const { deps, mem } = setup({ bundled, remote, serve });
      expect(await resolveFiles(deps)).toMatchObject({ version: "a1", source: "bundled" });
      expect(mem.state.manifest).toBeUndefined();
    }
  });

  test("после обновления самого приложения вшитая сборка новее скачанной: берётся она, старый кэш чистится", async() => {
    const old = manifest("a2", { "index.js": "i1", "game.js": "g2" });
    const mem = memory({ manifest: old, files: { "game.js": { hash: "g2", blob: new Blob(["g2"]) } } });
    const { deps } = setup({ bundled: manifest("a3", { "index.js": "i3", "game.js": "g3" }), remote: "offline", memory: mem });
    expect(await resolveFiles(deps)).toMatchObject({ version: "a3", source: "bundled" });
    expect(mem.state.manifest).toBeUndefined();
    expect(Object.keys(mem.state.files)).toEqual([]);
  });

  test("опись с сайта без нужного файла (или сломанная) игнорируется", async() => {
    const bundled = manifest("a1", same);
    for(const remote of [manifest("a2", { "index.js": "i2" }), manifest("плохо!", { "index.js": "i2", "game.js": "g2" }), undefined]) {
      const { deps, downloads } = setup({ bundled, remote, serve: { "index.js": "i2", "game.js": "g2" } });
      expect(await resolveFiles(deps)).toMatchObject({ version: "a1", source: "bundled" });
      expect(downloads).toEqual([]);
    }
  });
});
