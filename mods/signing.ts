import { hashText } from "./hash";

/**
 * подпись автора мода: ECDSA P-256 (поддерживается в любом браузере и в bun). Подписывается не весь файл, а id, версия, автор и хеш кода,
 * поэтому поменять код, версию или ник автора в файле нельзя, не сломав подпись. Ключ автора - его «удостоверение»: проверенный
 * ключ обновления того же автора принимаются без новой проверки
 */
export interface ModSignature {
  /** открытый ключ автора: 65 байт (raw), base64 */
  key: string
  /** подпись: 64 байта, base64 */
  value: string
}

export interface AuthorKey {
  /** открытый ключ, base64 (это можно показывать всем) */
  publicKey: string
  /** закрытый ключ, base64 (pkcs8): хранится только у автора, его нельзя никому отдавать */
  privateKey: string
}

const ALGORITHM = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN = { name: "ECDSA", hash: "SHA-256" } as const;

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string): Uint8Array<ArrayBuffer> => { const raw = atob(text), bytes = new Uint8Array(new ArrayBuffer(raw.length)); for(let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i); return bytes; };

/** что именно подписывается: версия формата, id, версия мода, ник автора и хеш кода */
export async function signedMessage(manifest: { id: string, version: string, author?: string }, code: string): Promise<Uint8Array<ArrayBuffer>> {
  return Uint8Array.from(new TextEncoder().encode(["bafia-mod-v1", manifest.id, manifest.version, manifest.author ?? "", await hashText(code)].join("\n")));
}

export async function generateAuthorKey(): Promise<AuthorKey> {
  const pair = await crypto.subtle.generateKey(ALGORITHM, true, ["sign", "verify"]);
  return {
    publicKey: toBase64(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))),
    privateKey: toBase64(new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey)))
  };
}

export async function signMod(manifest: { id: string, version: string, author?: string }, code: string, key: AuthorKey): Promise<ModSignature> {
  const privateKey = await crypto.subtle.importKey("pkcs8", fromBase64(key.privateKey), ALGORITHM, false, ["sign"]);
  const value = new Uint8Array(await crypto.subtle.sign(SIGN, privateKey, await signedMessage(manifest, code)));
  return { key: key.publicKey, value: toBase64(value) };
}

/** подпись верна: код, id, версия и автор именно те, что подписал владелец ключа; любая ошибка разбора - просто «нет» */
export async function verifyMod(manifest: { id: string, version: string, author?: string }, code: string, signature: ModSignature): Promise<boolean> {
  try {
    const publicKey = await crypto.subtle.importKey("raw", fromBase64(signature.key), ALGORITHM, false, ["verify"]);
    return await crypto.subtle.verify(SIGN, publicKey, fromBase64(signature.value), await signedMessage(manifest, code));
  } catch {
    return false;
  }
}

/** короткий отпечаток ключа (16 знаков): по нему ключи различают в списках и на сайте */
export const keyId = async (publicKey: string): Promise<string> => (await hashText(publicKey)).slice(0, 16);

/** подпись из файла мода: только строки нужной формы, иначе её нет */
export function parseSignature(raw: unknown): ModSignature | undefined {
  if(typeof raw != "object" || raw === null) return undefined;
  const { key, value } = raw as Record<string, unknown>;
  const base64 = /^[A-Za-z0-9+/]+={0,2}$/;
  if(typeof key != "string" || typeof value != "string" || key.length > 200 || value.length > 200 || !base64.test(key) || !base64.test(value)) return undefined;
  return { key, value };
}
