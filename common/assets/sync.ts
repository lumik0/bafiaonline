import type { FileStore } from "../storage/files";
import { decodePack, fromBase64, gunzip, type AssetsMeta } from "./pack";

/** где лежат ассеты; тот же путь, что у старой версии, поэтому файлы переиспользуются */
export const ASSETS_ROOT = "/game/assets";

/** сценарии загрузки: образ приезжает отдельными скриптами, чтобы работать и с file:// */
export interface AssetsSource {
  /** оглавление: пути и SHA-1; маленькое */
  meta(): Promise<AssetsMeta>
  /** сам образ: gzip в base64; большой, грузится только если что-то изменилось */
  data(): Promise<string>
}

export interface SyncProgress {
  /** сколько файлов проверено / всего */
  checked: number
  total: number
  /** сколько скачано и записано */
  written: number
}

export interface SyncResult {
  written: string[]
  /** сколько файлов уже было актуальным */
  upToDate: number
}

/**
 * приводит файлы в хранилище в соответствие с образом: пишет только новые и изменившиеся
 * если всё актуально, большой образ даже не скачивается
 */
export async function syncAssets(
  files: FileStore,
  source: AssetsSource,
  onProgress: (progress: SyncProgress) => void = () => {},
  root = ASSETS_ROOT
): Promise<SyncResult> {
  const meta = await source.meta();
  const total = meta.files.length;

  const stale = new Set<string>();
  let checked = 0;
  for(const file of meta.files) {
    if(await files.sha1(`${root}/${file.path}`) !== file.sha1) stale.add(file.path);
    onProgress({ checked: ++checked, total, written: 0 });
  }
  if(!stale.size) return { written: [], upToDate: total };

  const pack = decodePack(await gunzip(fromBase64(await source.data())));
  const written: string[] = [];
  for(const file of pack) {
    if(!stale.has(file.path)) continue;
    await files.writeBytes(`${root}/${file.path}`, file.data);
    written.push(file.path);
    onProgress({ checked: total, total, written: written.length });
  }
  return { written, upToDate: total - written.length };
}
