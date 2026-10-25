import type { FileStore } from "../storage/files";
import Events from "../utils/emitter";
import { ASSETS_ROOT } from "./sync";

const CUSTOM_ROOT = "/custom-assets";
const MAX_CUSTOM_SIZE = 5 * 1024 * 1024;

const mimeTypes: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", ico: "image/x-icon", mp4: "video/mp4"
};

const mimeOf = (path: string) => mimeTypes[path.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

export class CustomImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomImageError";
  }
}

export interface AssetsOptions {
  root?: string
  /** превращает байты в адрес для `<img src>`; в тестах подменяется */
  createUrl?: (bytes: Uint8Array, mime: string) => string
  revokeUrl?: (url: string) => void
}

/**
 * картинки игры. Берёт файл игрока (кастомную замену), а если её нет, стандартный из образа
 * адрес выдаётся сразу; пока картинка читается из хранилища, он пустой, а по готовности приходит `change`
 */
export class Assets extends Events<{ change: (path: string) => void }> {
  private urls = new Map<string, string>();
  private loading = new Set<string>();
  /** картинок нет ни у игрока, ни в образе; не перечитываем при каждом обращении */
  private missing = new Set<string>();
  private custom = new Set<string>();

  private root: string;
  private createUrl: NonNullable<AssetsOptions["createUrl"]>;
  private revokeUrl: NonNullable<AssetsOptions["revokeUrl"]>;

  constructor(private files: FileStore, options: AssetsOptions = {}) {
    super();
    this.root = options.root ?? ASSETS_ROOT;
    this.createUrl = options.createUrl ?? ((bytes, mime) => URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime })));
    this.revokeUrl = options.revokeUrl ?? (url => URL.revokeObjectURL(url));
  }

  /** какие картинки уже заменены игроком; вызвать один раз при запуске */
  async init() {
    this.custom = new Set(await this.walk(CUSTOM_ROOT, ""));
  }

  private async walk(root: string, dir: string): Promise<string[]> {
    const result: string[] = [];
    for(const name of await this.files.list(`${root}/${dir}`)) {
      const path = dir ? `${dir}/${name}` : name;
      // у файла нет потомков, у папки есть
      const children = await this.files.list(`${root}/${path}`);
      if(children.length) result.push(...await this.walk(root, path));
      else result.push(path);
    }
    return result;
  }

  isCustom(path: string) { return this.custom.has(path); }

  /** адрес для `<img src>` или `""`, пока картинка не загружена */
  url(path: string): string {
    const url = this.urls.get(path);
    if(url !== undefined) return url;
    if(!this.missing.has(path)) void this.load(path);
    return "";
  }

  async load(path: string): Promise<string> {
    const cached = this.urls.get(path);
    if(cached) return cached;
    if(this.loading.has(path)) return "";
    this.loading.add(path);

    try {
      const bytes = (this.custom.has(path) ? await this.files.readBytes(`${CUSTOM_ROOT}/${path}`) : undefined)
        ?? await this.files.readBytes(`${this.root}/${path}`);
      if(!bytes) {
        this.missing.add(path);
        return "";
      }

      const url = this.createUrl(bytes, mimeOf(path));
      this.urls.set(path, url);
      this.emit("change", path);
      return url;
    } finally {
      this.loading.delete(path);
    }
  }

  /** текстовый файл из образа (например, Lottie-анимация); своих замен для него нет */
  async readText(path: string): Promise<string | undefined> {
    return this.files.read(`${this.root}/${path}`);
  }

  /** заменяет картинку своей. Принимает только изображения не больше 5 МБ */
  async setCustom(path: string, bytes: Uint8Array, mime: string) {
    if(!mime.startsWith("image/")) throw new CustomImageError("Нужна картинка (png, jpg, webp, gif)");
    if(bytes.length > MAX_CUSTOM_SIZE) throw new CustomImageError("Картинка больше 5 МБ");

    await this.files.writeBytes(`${CUSTOM_ROOT}/${path}`, bytes);
    this.custom.add(path);
    await this.reload(path);
  }

  async clearCustom(path: string) {
    await this.files.remove(`${CUSTOM_ROOT}/${path}`);
    this.custom.delete(path);
    await this.reload(path);
  }

  /** перечитать картинку из хранилища (после обновления образа) */
  async reload(path: string) {
    const old = this.urls.get(path);
    this.urls.delete(path);
    this.missing.delete(path);
    await this.load(path);
    if(old) this.revokeUrl(old);
  }
}
