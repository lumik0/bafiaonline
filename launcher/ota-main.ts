import { resolveFiles, type Manifest, type OtaStore } from "./ota";

/**
 * загрузчик приложения (Android, iOS): запускает лаунчер и игру, но не из того, что вшито в приложение, а из самой свежей сборки с сайта
 * (без переустановки). Лежит в приложении и сам не обновляется, поэтому маленький и без зависимостей
 */
const SITE_URL = "https://lumik0.github.io/bafiaonline/play/bin/";
/** для проверки на своём компьютере: ?ota=http://localhost:порт/ вместо сайта (только localhost, чужой адрес игнорируется) */
const override = new URLSearchParams(location.search).get("ota");
const SITE = override && /^http:\/\/localhost:\d+\//.test(override) ? override : SITE_URL;
const LOCAL = "./play/bin/";

declare global { interface Window { __bafiaFiles?: Record<string, string>, __bafiaBuild?: string } }

/** хранилище скачанных файлов в IndexedDB; без него (закрытый режим и т.п.) всё работает, просто без запоминания */
function openStore(): OtaStore {
  const opened = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("bafia-ota", 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("files"); request.result.createObjectStore("meta"); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const run = async<T>(store: "files" | "meta", mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> => {
    const db = await opened;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, mode);
      const request = action(transaction.objectStore(store));
      transaction.oncomplete = () => resolve(request ? request.result : undefined);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  };
  return {
    file: async name => await run<{ hash: string, blob: Blob }>("files", "readonly", store => store.get(name)),
    putFile: async(name, hash, blob) => { await run("files", "readwrite", store => store.put({ hash, blob }, name)); },
    manifest: async() => await run<Manifest>("meta", "readonly", store => store.get("manifest")),
    putManifest: async manifest => { await run("meta", "readwrite", store => store.put(manifest, "manifest")); },
    clear: async() => { await run("files", "readwrite", store => store.clear()); await run("meta", "readwrite", store => store.clear()); }
  };
}

const fetchWithTimeout = (url: string, ms: number) => fetch(url, { cache: "no-store", signal: AbortSignal.timeout(ms) });

async function hashOf(blob: Blob) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", await blob.arrayBuffer()));
  return [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Не удалось загрузить " + src));
    document.body.appendChild(script);
  });
}

async function main() {
  const root = document.getElementById("root");
  const say = (text: string) => { if(root) root.innerHTML = `<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#ddd;font:16px sans-serif">${text}</div>`; };
  const bundled = await (await fetch(LOCAL + "manifest.json")).json() as Manifest;
  const bundledUrl = (name: string) => `${LOCAL}${name}?v=${bundled.version}`;
  let result: Awaited<ReturnType<typeof resolveFiles>> | undefined;
  try {
    result = await resolveFiles({
      bundled, bundledUrl, progress: say, warn: message => console.warn("[ota]", message),
      store: openStore(),
      remoteManifest: async() => {
        const response = await fetchWithTimeout(`${SITE}manifest.json?t=${Date.now()}`, 3500);
        return response.ok ? await response.json() as Manifest : undefined;
      },
      download: async name => {
        const response = await fetchWithTimeout(`${SITE}${name}?t=${Date.now()}`, 90_000);
        if(!response.ok) throw new Error(`Файл ${name}: ${response.status}`);
        return await response.blob();
      },
      hash: hashOf,
      objectUrl: blob => URL.createObjectURL(blob)
    });
  } catch(error) {
    // загрузчик не должен мешать запуску: берём то, что вшито
    console.warn("[ota]", error);
  }
  console.info("[ota] запуск:", result?.source ?? "вшитая (сбой загрузчика)", result?.version ?? bundled.version);
  window.__bafiaFiles = result?.files ?? Object.fromEntries(Object.keys(bundled.files).map(name => [name, bundledUrl(name)]));
  window.__bafiaBuild = result?.version ?? bundled.version;
  await loadScript(window.__bafiaFiles["index.js"]!);
}

void main().catch(error => {
  const root = document.getElementById("root");
  if(root) root.textContent = "Не удалось запустить игру: " + (error instanceof Error ? error.message : String(error));
});
