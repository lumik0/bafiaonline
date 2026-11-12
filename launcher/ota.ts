/** опись файлов сборки: метка (число в 36-ричной записи, больше - новее) и короткий хеш каждого файла из play/bin */
export interface Manifest { version: string, files: Record<string, string> }

export interface OtaStore {
  file(name: string): Promise<{ hash: string, blob: Blob } | undefined>
  putFile(name: string, hash: string, blob: Blob): Promise<void>
  manifest(): Promise<Manifest | undefined>
  putManifest(manifest: Manifest): Promise<void>
  /** убрать из хранилища всё (файлы вшитой версии свежее) */
  clear(): Promise<void>
}

export interface OtaDeps {
  /** опись файлов, вшитых в приложение: ими запускаемся, если сети нет */
  bundled: Manifest
  bundledUrl: (name: string) => string
  /** опись с сайта; нет сети или сайт не ответил - `undefined` */
  remoteManifest: () => Promise<Manifest | undefined>
  download: (name: string) => Promise<Blob>
  /** короткий хеш содержимого (как в описи) */
  hash: (blob: Blob) => Promise<string>
  store: OtaStore
  objectUrl: (blob: Blob) => string
  /** что сейчас происходит (для надписи на экране) */
  progress?: (text: string) => void
  /** почему сборку не удалось собрать (журнал) */
  warn?: (message: string) => void
}

export type OtaSource = "bundled" | "cache" | "remote";

/** метки сравниваются как числа: у выложенной позже метка больше */
export const newer = (a: Manifest, b: Manifest) => parseInt(a.version, 36) > parseInt(b.version, 36);

/** опись пригодна, если в ней есть все файлы, которые есть во вшитой (иначе скрипты не найдут друг друга) */
const complete = (manifest: Manifest | undefined, bundled: Manifest): manifest is Manifest =>
  !!manifest && typeof manifest.version == "string" && /^[a-z0-9]+$/.test(manifest.version) && Object.keys(bundled.files).every(name => typeof manifest.files?.[name] == "string");

/**
 * какие файлы запускать: самая свежая из описей (сайт, прошлое скачивание, вшитая), у которой все файлы удалось получить.
 * Наборы целые: лаунчер, игра и образ картинок берутся от одной сборки, смешивать версии нельзя. Любой сбой - берём следующую
 * по свежести, в конце всегда вшитая (она есть в самом приложении)
 */
export async function resolveFiles(deps: OtaDeps): Promise<{ version: string, files: Record<string, string>, source: OtaSource }> {
  const { bundled, store } = deps;
  const remote = await deps.remoteManifest().catch(() => undefined);
  const cached = await store.manifest().catch(() => undefined);
  const candidates: { manifest: Manifest, source: OtaSource }[] = [];
  if(complete(remote, bundled)) candidates.push({ manifest: remote, source: "remote" });
  if(complete(cached, bundled)) candidates.push({ manifest: cached, source: "cache" });
  candidates.push({ manifest: bundled, source: "bundled" });
  candidates.sort((a, b) => parseInt(b.manifest.version, 36) - parseInt(a.manifest.version, 36));

  for(const { manifest, source } of candidates) {
    try {
      const files: Record<string, string> = {};
      const missing: string[] = [];
      for(const [name, hash] of Object.entries(manifest.files)) {
        if(!(name in bundled.files)) continue;
        if(bundled.files[name] == hash) { files[name] = deps.bundledUrl(name); continue; }
        const stored = await store.file(name).catch(() => undefined);
        if(stored?.hash == hash) { files[name] = deps.objectUrl(stored.blob); continue; }
        missing.push(name);
      }
      if(missing.length) {
        // докачать можно только с сайта
        if(source != "remote") continue;
        deps.progress?.("Обновляю игру…");
        const blobs = await Promise.all(missing.map(async name => {
          const blob = await deps.download(name);
          if(await deps.hash(blob) != manifest.files[name]) throw new Error(`Файл ${name} скачан не полностью`);
          return [name, blob] as const;
        }));
        for(const [name, blob] of blobs) {
          await store.putFile(name, manifest.files[name]!, blob).catch(() => {});
          files[name] = deps.objectUrl(blob);
        }
      }
      if(source == "remote") await store.putManifest(manifest).catch(() => {});
      if(source == "bundled") await store.clear().catch(() => {});
      return { version: manifest.version, files, source };
    } catch(error) {
      // эта сборка не собралась: пробуем прошлую
      deps.warn?.(`сборка ${manifest.version} (${source}) не собралась: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  // сюда не дойти: вшитая всегда собирается
  return { version: bundled.version, files: Object.fromEntries(Object.keys(bundled.files).map(name => [name, deps.bundledUrl(name)])), source: "bundled" };
}
