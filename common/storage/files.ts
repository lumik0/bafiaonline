import { digestHex } from "../utils/digest";
import { requestToPromise, STORE_NAME, transactionDone } from "./idb";

/** файлы по путям вида `/profiles.json`: текстовые (настройки) и двоичные (картинки) */
export interface FileStore {
  read(path: string): Promise<string | undefined>
  write(path: string, text: string): Promise<void>
  readBytes(path: string): Promise<Uint8Array | undefined>
  writeBytes(path: string, bytes: Uint8Array): Promise<void>
  /** SHA-1 содержимого (hex); у файлов старой версии берётся из записи */
  sha1(path: string): Promise<string | undefined>
  exists(path: string): Promise<boolean>
  remove(path: string): Promise<void>
  /** имена прямых потомков папки */
  list(dir: string): Promise<string[]>
  /** стирает ВСЁ: аккаунты, настройки, ассеты. Только по явной просьбе игрока */
  clear(): Promise<void>
}

export const normalizePath = (path: string) => path.startsWith("/") ? path : `/${path}`;

export const sha1Hex = (bytes: Uint8Array): Promise<string> => digestHex(bytes, "SHA-1");

/** запись в хранилище в том же виде, как её писала старая версия (там `content` - всегда Blob) */
interface FileEntry {
  type: "file"
  content: Blob
  createdAt?: number
  modifiedAt?: number
  sha1?: string
}

async function readContent(content: unknown): Promise<Uint8Array> {
  if(content instanceof Blob) return new Uint8Array(await content.arrayBuffer());
  if(typeof content == "string") return new TextEncoder().encode(content);
  if(content instanceof Uint8Array) return content;
  throw new Error("Неподдерживаемый формат файла в хранилище");
}

export class IdbFileStore implements FileStore {
  constructor(private db: IDBDatabase) {}

  private store(mode: IDBTransactionMode) {
    const transaction = this.db.transaction(STORE_NAME, mode);
    return { store: transaction.objectStore(STORE_NAME), transaction };
  }

  private async entry(path: string): Promise<FileEntry | undefined> {
    const entry = await requestToPromise(this.store("readonly").store.get(normalizePath(path)));
    return entry?.type == "file" ? entry : undefined;
  }

  async read(path: string) {
    const bytes = await this.readBytes(path);
    return bytes && new TextDecoder().decode(bytes);
  }

  readBytes = async(path: string) => {
    const entry = await this.entry(path);
    return entry && readContent(entry.content);
  };

  write(path: string, text: string) {
    return this.writeContent(path, new Blob([text]), undefined);
  }

  async writeBytes(path: string, bytes: Uint8Array) {
    return this.writeContent(path, new Blob([bytes as BlobPart]), await sha1Hex(bytes));
  }

  private async writeContent(path: string, content: Blob, sha1: string | undefined) {
    const key = normalizePath(path);
    const { store, transaction } = this.store("readwrite");

    // чтение и запись в одной транзакции, иначе параллельные записи теряют друг друга
    const existing = await requestToPromise(store.get(key)) as FileEntry | undefined;
    const now = Date.now();
    const entry: FileEntry = {
      type: "file",
      content,
      createdAt: existing?.type == "file" ? existing.createdAt ?? now : now,
      modifiedAt: now,
      ...(sha1 ? { sha1 } : {})
    };
    store.put(entry, key);
    await transactionDone(transaction);
  }

  async sha1(path: string) {
    const entry = await this.entry(path);
    if(!entry) return undefined;
    return entry.sha1 ?? sha1Hex(await readContent(entry.content));
  }

  async exists(path: string) {
    return !!await this.entry(path);
  }

  async remove(path: string) {
    const { store, transaction } = this.store("readwrite");
    store.delete(normalizePath(path));
    await transactionDone(transaction);
  }

  async clear() {
    const { store, transaction } = this.store("readwrite");
    store.clear();
    await transactionDone(transaction);
  }

  async list(dir: string) {
    const prefix = normalizePath(dir).replace(/\/?$/, "/");
    const keys = await requestToPromise(this.store("readonly").store.getAllKeys(IDBKeyRange.bound(prefix, prefix + "￿")));
    return [...new Set(keys.map(key => String(key).slice(prefix.length).split("/")[0]!))];
  }
}

export class MemoryFileStore implements FileStore {
  private files = new Map<string, Uint8Array>();

  async read(path: string) {
    const bytes = this.files.get(normalizePath(path));
    return bytes && new TextDecoder().decode(bytes);
  }
  async write(path: string, text: string) { this.files.set(normalizePath(path), new TextEncoder().encode(text)); }
  async readBytes(path: string) { return this.files.get(normalizePath(path)); }
  async writeBytes(path: string, bytes: Uint8Array) { this.files.set(normalizePath(path), bytes.slice()); }
  async sha1(path: string) {
    const bytes = this.files.get(normalizePath(path));
    return bytes && sha1Hex(bytes);
  }
  async exists(path: string) { return this.files.has(normalizePath(path)); }
  async remove(path: string) { this.files.delete(normalizePath(path)); }
  async clear() { this.files.clear(); }
  async list(dir: string) {
    const prefix = normalizePath(dir).replace(/\/?$/, "/");
    return [...new Set([...this.files.keys()].filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length).split("/")[0]!))];
  }
}
