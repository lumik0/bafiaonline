/**
 * база новой версии. Старая версия хранит данные в `BafiaOnline` (LEGACY_DB_NAME): её мы только читаем
 * при переносе (legacy.ts) и никогда не меняем, чтобы старая версия продолжала работать как раньше
 * формат записей как в старой версии, чтобы переносить файлы без преобразований
 */
export const DB_NAME = "BafiaOnline2";
export const LEGACY_DB_NAME = "BafiaOnline";
export const DB_VERSION = 1;
export const STORE_NAME = "Storage";

export function openDatabase(factory: IDBFactory = indexedDB, name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, DB_VERSION);
    request.onupgradeneeded = () => {
      // первый запуск; у существующих игроков хранилище уже есть
      if(!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const transactionDone = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
