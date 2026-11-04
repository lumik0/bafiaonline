type Http = (input: string, init?: RequestInit) => Promise<Response>;

export interface GifCacheOptions {
  /** сколько живёт запись, мс (по умолчанию 5 минут) */
  ttl?: number
  /** сколько байт держать в памяти, дальше вытесняются самые старые */
  maxBytes?: number
  fetch?: Http
  createUrl?: (blob: Blob) => string
  revokeUrl?: (url: string) => void
  now?: () => number
}

interface Entry { at: number, size: number, shown: Promise<string>, blobUrl?: string }

/**
 * Короткий кэш гифок из сообщений: скачивает файл сразу, как только сообщение появилось, и отдаёт готовый blob-адрес,
 * поэтому гифка не мигает при перерисовке чата и не грузится заново. Через 5 минут запись удаляется, память освобождается.
 * Если скачать нельзя (сайт запретил чтение, нет сети), отдаётся сам адрес: картинка загрузится обычным способом.
 */
export class GifCache {
  private entries = new Map<string, Entry>();
  private ttl: number;
  private maxBytes: number;
  private http: Http;
  private createUrl: (blob: Blob) => string;
  private revokeUrl: (url: string) => void;
  private now: () => number;

  constructor(options: GifCacheOptions = {}) {
    this.ttl = options.ttl ?? 5 * 60_000;
    this.maxBytes = options.maxBytes ?? 40 * 1024 * 1024;
    this.http = options.fetch ?? ((input, init) => fetch(input, init));
    this.createUrl = options.createUrl ?? (blob => URL.createObjectURL(blob));
    this.revokeUrl = options.revokeUrl ?? (url => URL.revokeObjectURL(url));
    this.now = options.now ?? Date.now;
  }

  get size() { return this.entries.size; }

  /** адрес для `<img>`: из кэша или после скачивания; ошибка скачивания - исходный адрес */
  load(url: string): Promise<string> {
    this.purge();
    const hit = this.entries.get(url);
    if(hit) return hit.shown;

    const entry: Entry = { at: this.now(), size: 0, shown: Promise.resolve(url) };
    entry.shown = (async() => {
      try {
        const response = await this.http(url, { referrerPolicy: "no-referrer" });
        if(!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        // запись могли уже убрать (устарела или вытеснена): тогда адрес не создаём, чтобы не оставлять утечку
        if(this.entries.get(url) !== entry) return url;
        entry.size = blob.size;
        entry.blobUrl = this.createUrl(blob);
        this.trim();
        return entry.blobUrl;
      } catch {
        // неудачу не запоминаем: следующая попытка скачает заново
        if(this.entries.get(url) === entry) this.entries.delete(url);
        return url;
      }
    })();
    this.entries.set(url, entry);
    return entry.shown;
  }

  /** удаляет устаревшие записи и освобождает их blob-адреса */
  purge() {
    const now = this.now();
    for(const [url, entry] of this.entries) if(now - entry.at >= this.ttl) this.remove(url);
  }

  private remove(url: string) {
    const entry = this.entries.get(url);
    this.entries.delete(url);
    if(entry?.blobUrl) this.revokeUrl(entry.blobUrl);
  }

  /** держит объём в пределах лимита: убирает самые старые, пока не влезет */
  private trim() {
    let total = [...this.entries.values()].reduce((sum, entry) => sum + entry.size, 0);
    for(const [url, entry] of this.entries) {
      if(total <= this.maxBytes || this.entries.size <= 1) break;
      total -= entry.size;
      this.remove(url);
    }
  }

  /** убрать всё сразу (выход из игры) */
  clear() { for(const url of [...this.entries.keys()]) this.remove(url); }
}
