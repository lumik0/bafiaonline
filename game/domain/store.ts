import Events from "@common/utils/emitter";
import type { JsonDocument } from "@common/storage";

const SAVE_DELAY = 300;

/** данные из JSON-файла; `update` сообщает подписчикам и сохраняет сам */
export class DocumentStore<T> extends Events<{ change: () => void }> {
  private timer?: ReturnType<typeof setTimeout>;

  constructor(private document: JsonDocument<T>, public data: T) {
    super();
  }

  static async load<T>(document: JsonDocument<T>) {
    return new DocumentStore(document, await document.read());
  }

  update(change: (data: T) => void) {
    change(this.data);
    this.emit("change");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), SAVE_DELAY);
  }

  /** заменить всё целиком (например, сброс фильтра) */
  set(data: T) {
    this.update(current => { this.data = data; void current; });
  }

  async flush() {
    clearTimeout(this.timer);
    await this.document.write(this.data);
  }
}
