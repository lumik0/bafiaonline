import { Accounts } from "./accounts";
import { IdbFileStore, type FileStore } from "./files";
import { LEGACY_DB_NAME, STORE_NAME } from "./idb";

/** файлы старой версии, которые переносятся как есть, если в новой базе таких ещё нет */
const COPIED_FILES = ["/options.json", "/game/settings.json", "/game/history.json", "/game/filter.json"];
const MARKER = "/migrated-from-legacy.json";
const LEGACY_ACCOUNTS = "/profiles.json";

/**
 * открывает базу старой версии только если она уже есть. Обычный `indexedDB.open` создал бы пустую базу,
 * поэтому на создание (`upgradeneeded`) отвечаем отменой: ничего не появляется
 */
export function openLegacyDatabase(factory: IDBFactory = indexedDB, name = LEGACY_DB_NAME): Promise<IDBDatabase | undefined> {
  return new Promise(resolve => {
    const request = factory.open(name);
    request.onupgradeneeded = () => request.transaction?.abort();
    request.onerror = () => resolve(undefined);
    request.onblocked = () => resolve(undefined);
    request.onsuccess = () => {
      const db = request.result;
      if(db.objectStoreNames.contains(STORE_NAME)) resolve(db);
      else { db.close(); resolve(undefined); }
    };
  });
}

export interface LegacyImport {
  /** сколько аккаунтов принято из старой версии */
  accounts: number
  /** какие файлы скопированы */
  copied: string[]
  /** старой базы нет (игрок не пользовался старой версией в этом браузере) */
  noLegacy: boolean
}

export interface LegacyOptions {
  factory?: IDBFactory
  name?: string
}

/**
 * переносит данные старой версии в новую базу. Старая версия НЕ трогается
 * аккаунты добавляются к существующим, файлы копируются, если их ещё нет
 */
export async function importFromLegacy(target: FileStore, accounts: Accounts, options: LegacyOptions = {}): Promise<LegacyImport> {
  const db = await openLegacyDatabase(options.factory, options.name);
  if(!db) return { accounts: 0, copied: [], noLegacy: true };

  try {
    return await copyFrom(new IdbFileStore(db), target, accounts);
  } finally {
    db.close();
  }
}

async function copyFrom(legacy: FileStore, target: FileStore, accounts: Accounts): Promise<LegacyImport> {
  const copied: string[] = [];
  let imported = 0;

  const text = await legacy.read(LEGACY_ACCOUNTS);
  if(text) {
    try {
      const entries = JSON.parse(text);
      if(Array.isArray(entries)) imported = await accounts.importRaw(entries);
    } catch {
      // у игрока испорченный profiles.json в старой версии: без аккаунтов, но остальное переносим
    }
  }

  for(const path of COPIED_FILES) {
    if(await target.exists(path)) continue;
    const content = await legacy.read(path);
    if(content === undefined) continue;
    await target.write(path, content);
    copied.push(path);
  }
  return { accounts: imported, copied, noLegacy: false };
}

/**
 * разовый автоматический перенос при первом запуске. Отметка остаётся и если старой базы нет:
 * иначе удалённые аккаунты вернулись бы при каждом запуске
 */
export async function migrateOnFirstRun(target: FileStore, accounts: Accounts, options: LegacyOptions = {}): Promise<LegacyImport | undefined> {
  if(await target.exists(MARKER)) return undefined;
  const result = await importFromLegacy(target, accounts, options);
  await target.write(MARKER, JSON.stringify({ version: 1, at: Date.now(), ...result }));
  return result;
}
