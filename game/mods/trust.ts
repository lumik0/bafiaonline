import { nickKey } from "@common/bafia/protocol";
import type { ModPackage } from "@mods/index";

/** открытый список для игры: проверенные и запрещённые версии модов (по хешу кода) и ключи авторов; скачивается целиком и сверяется у игрока */
export interface ModRegistry {
  approved: string[]
  blocked: { hash: string, note: string }[]
  authors: { trusted: { id: string, nick: string }[], blocked: { id: string, note: string }[] }
}

/** кому и насколько верить моду */
export type ModTrust =
  /** встроенный мод игры */
  | { level: "official" }
  /** версия запрещена или автор запрещён: мод отключается */
  | { level: "blocked", reason: string }
  /** эту версию проверили */
  | { level: "verified" }
  /** подпись верна и ключ принадлежит проверенному автору: его версии принимаются без новой проверки */
  | { level: "author", nick: string }
  /** подпись верна, но автора не проверяли */
  | { level: "signed", nick: string }
  /** подписи нет */
  | { level: "unsigned" }
  /** подпись есть, но не сходится с кодом: файл изменили */
  | { level: "invalid" };

const HASH = /^[0-9a-f]{64}$/;
const KEY_ID = /^[0-9a-f]{16}$/;
const note = (value: unknown) => typeof value == "string" ? value.slice(0, 120) : "";

/** список с сервера - чужие данные: берём только строки нужной формы */
export function parseRegistry(raw: unknown): ModRegistry | undefined {
  if(typeof raw != "object" || raw === null) return undefined;
  const data = raw as Record<string, unknown>, authors = (typeof data.authors == "object" && data.authors !== null ? data.authors : {}) as Record<string, unknown>;
  const list = (value: unknown) => Array.isArray(value) ? value.slice(0, 5000) : [];
  const record = (value: unknown) => (typeof value == "object" && value !== null ? value : {}) as Record<string, unknown>;
  return {
    approved: list(data.approved).filter((hash): hash is string => typeof hash == "string" && HASH.test(hash)),
    blocked: list(data.blocked).map(record).filter(item => typeof item.hash == "string" && HASH.test(item.hash)).map(item => ({ hash: item.hash as string, note: note(item.note) })),
    authors: {
      trusted: list(authors.trusted).map(record).filter(item => typeof item.id == "string" && KEY_ID.test(item.id) && typeof item.nick == "string").map(item => ({ id: item.id as string, nick: (item.nick as string).slice(0, 60) })),
      blocked: list(authors.blocked).map(record).filter(item => typeof item.id == "string" && KEY_ID.test(item.id)).map(item => ({ id: item.id as string, note: note(item.note) }))
    }
  };
}

/**
 * доверие к моду: запрет (версии или автора) важнее всего, потом проверенная версия, потом подпись проверенного автора, потом просто подпись.
 * `signature` - результат проверки подписи в игре: верна ли и отпечаток ключа; `undefined` - подписи нет
 */
export function evaluateTrust(mod: Pick<ModPackage, "manifest"> & { sha256: string }, signature: { valid: boolean, keyId: string } | undefined, registry: ModRegistry | undefined, builtIn: boolean): ModTrust {
  if(builtIn) return { level: "official" };
  const hash = mod.sha256.toLowerCase();
  const blockedVersion = registry?.blocked.find(item => item.hash == hash);
  if(blockedVersion) return { level: "blocked", reason: blockedVersion.note || "версия запрещена" };
  if(signature?.valid) {
    const blockedAuthor = registry?.authors.blocked.find(item => item.id == signature.keyId);
    if(blockedAuthor) return { level: "blocked", reason: blockedAuthor.note || "автор запрещён" };
  }
  if(registry?.approved.includes(hash)) return { level: "verified" };
  if(!signature) return { level: "unsigned" };
  if(!signature.valid) return { level: "invalid" };
  const trusted = registry?.authors.trusted.find(item => item.id == signature.keyId);
  const author = mod.manifest.author ?? "";
  // доверенный ключ закреплён за ником: подпись с таким ключом, но с другим ником автора доверия не получает
  if(trusted && nickKey(trusted.nick) == nickKey(author)) return { level: "author", nick: trusted.nick };
  return { level: "signed", nick: author };
}

/** одной строкой для игрока */
export function trustText(trust: ModTrust): string {
  switch(trust.level) {
    case "official": return "Встроенный мод игры";
    case "blocked": return `Запрещён Бафией: ${trust.reason}`;
    case "verified": return "Проверен Бафией";
    case "author": return `Автор «${trust.nick}» проверен Бафией`;
    case "signed": return `Подписан автором «${trust.nick || "?"}», автор пока не проверен`;
    case "unsigned": return "Не подписан и не проверен: ставь на свой риск";
    case "invalid": return "Подпись не сходится с кодом: файл изменили. Не проверен";
  }
}

/** кому разрешена отправка на проверку: подписавший мод автор, чей ник в Бафии - ник игрока; уже проверенным и запрещённым не нужна */
export function canSubmitForReview(mod: Pick<ModPackage, "manifest" | "signature">, trust: ModTrust, myNick: string): boolean {
  if(trust.level != "signed" || !mod.signature) return false;
  return !!mod.manifest.author && !!myNick && nickKey(mod.manifest.author) == nickKey(myNick);
}
