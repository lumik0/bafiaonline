import type { FileStore } from "./files";

export interface DocumentOptions<T> {
  path: string
  defaults(): T
  /** приводит то, что лежит в файле (любой старой версии), к актуальному виду */
  migrate?(raw: unknown): T
}

/** JSON-файл с типом, миграцией и защитой от потери данных */
export class JsonDocument<T> {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private files: FileStore, private options: DocumentOptions<T>) {}

  async read(): Promise<T> {
    const text = await this.files.read(this.options.path);
    if(text === undefined) return this.options.defaults();

    try {
      const raw = JSON.parse(text);
      return this.options.migrate ? this.options.migrate(raw) : raw as T;
    } catch {
      // файл испорчен: сохраняем копию, чтобы данные можно было достать руками, и не затираем молча
      await this.files.write(`${this.options.path}.corrupt-${Date.now()}`, text);
      return this.options.defaults();
    }
  }

  write(value: T): Promise<void> {
    return this.files.write(this.options.path, JSON.stringify(value));
  }

  /** чтение-изменение-запись по очереди: два одновременных update не теряют друг друга */
  update<R = void>(change: (value: T) => R | Promise<R>): Promise<R> {
    const run = async() => {
      const value = await this.read();
      const result = await change(value);
      await this.write(value);
      return result;
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => {});
    return result;
  }
}
