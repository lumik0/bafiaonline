import { Accounts } from "./accounts";
import { IdbFileStore, type FileStore } from "./files";
import { openDatabase } from "./idb";
import { gameSettings } from "./settings";

export { Accounts, isSameAccount, type Account } from "./accounts";
export { JsonDocument } from "./document";
export { IdbFileStore, MemoryFileStore, type FileStore } from "./files";
export { gameSettings, type GameSettings } from "./settings";
export { importFromLegacy, migrateOnFirstRun, openLegacyDatabase, type LegacyImport } from "./legacy";

export function createStorage(files: FileStore, mobile = false) {
  return { files, accounts: new Accounts(files), settings: gameSettings(files, mobile) };
}

/** хранилище в IndexedDB игрока, там же, где лежат его аккаунты */
export async function openStorage(mobile = false) {
  return createStorage(new IdbFileStore(await openDatabase()), mobile);
}
