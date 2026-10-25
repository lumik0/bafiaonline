import { hashText, sameHash } from "./hash";
import { parsePackage, type Manifest, type ModPackage } from "./manifest";

/** описание последней версии мода: JSON по адресу `updateUrl` из манифеста */
export interface UpdateInfo {
  version: string
  /** где лежит файл мода (абсолютный https-адрес на том же сайте, что и updateUrl) */
  fileUrl: string
  /** хеши файла мода целиком. Нужен хотя бы один; если указаны оба - должны совпасть оба */
  sha256?: string
  sha1?: string
}

export type FetchText = (url: string) => Promise<string>;

const MAX_FILE = 6 * 1024 * 1024;
const HEX = (length: number) => new RegExp(`^[0-9a-f]{${length}}$`, "i");

const numbers = (version: string) => version.split(/[.+-]/).map(part => Number.parseInt(part, 10));

/** новее ли `candidate`, чем `current` (1.10.0 > 1.9.0) */
export function isNewer(candidate: string, current: string): boolean {
  if(candidate == current) return false;
  const a = numbers(candidate), b = numbers(current);
  if(a.some(Number.isNaN) || b.some(Number.isNaN)) return true;
  for(let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    if(difference) return difference > 0;
  }
  return false;
}

export function parseUpdateInfo(raw: unknown, updateUrl: string): UpdateInfo {
  const data = (typeof raw == "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  if(typeof data.version != "string" || !data.version.trim() || data.version.length > 20) throw new Error("В описании обновления нет версии");

  let file: URL;
  try {
    file = new URL(String(data.file), updateUrl);
  } catch {
    throw new Error("В описании обновления неверный адрес файла");
  }
  // файл только с того же сайта и только по https: описание не может отправить загрузку на чужой сервер
  if(file.protocol != "https:" || file.origin != new URL(updateUrl).origin) throw new Error("Файл обновления должен лежать на том же сайте, что и описание");

  const sha256 = typeof data.sha256 == "string" ? data.sha256 : undefined;
  const sha1 = typeof data.sha1 == "string" ? data.sha1 : undefined;
  if(!sha256 && !sha1) throw new Error("В описании обновления нет хеша файла (sha256 или sha1)");
  if(sha256 && !HEX(64).test(sha256) || sha1 && !HEX(40).test(sha1)) throw new Error("Хеш в описании обновления записан неверно");

  return { version: data.version.trim(), fileUrl: file.href, sha256, sha1 };
}

/** спрашивает у автора, есть ли версия новее установленной. Ничего не скачивает и не ставит */
export async function checkForUpdate(manifest: Manifest, fetchText: FetchText): Promise<UpdateInfo | undefined> {
  if(!manifest.updateUrl) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(await fetchText(manifest.updateUrl));
  } catch(error) {
    throw new Error(error instanceof SyntaxError ? "Описание обновления - не JSON" : "Не удалось получить описание обновления");
  }
  const info = parseUpdateInfo(raw, manifest.updateUrl);
  return isNewer(info.version, manifest.version) ? info : undefined;
}

/** скачивает файл новой версии и проверяет всё, что можно проверить, до того как показать его игроку */
export async function downloadUpdate(manifest: Manifest, info: UpdateInfo, fetchText: FetchText): Promise<ModPackage> {
  let text: string;
  try {
    text = await fetchText(info.fileUrl);
  } catch {
    throw new Error("Не удалось скачать файл обновления");
  }
  if(text.length > MAX_FILE) throw new Error("Файл обновления слишком большой");

  if(info.sha256 && !sameHash(await hashText(text, "SHA-256"), info.sha256)) throw new Error("Хеш SHA-256 файла не совпал: файл изменён или повреждён");
  if(info.sha1 && !sameHash(await hashText(text, "SHA-1"), info.sha1)) throw new Error("Хеш SHA-1 файла не совпал: файл изменён или повреждён");

  const pack = parsePackage(text);
  if(pack.manifest.id != manifest.id) throw new Error("В файле обновления другой мод");
  if(pack.manifest.version != info.version) throw new Error("Версия в файле не совпадает с версией в описании");
  // адрес обновлений нельзя менять обновлением, иначе первый файл перенаправит все проверки
  if(pack.manifest.updateUrl != manifest.updateUrl) throw new Error("Обновление пытается сменить адрес обновлений");
  return pack;
}
