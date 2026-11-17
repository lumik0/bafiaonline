import { nickKey } from "@common/bafia/protocol";

/** запись чёрного списка: игрок узнаётся по id пользователя, id игрока или нику (что известно) */
export interface BlackEntry { userId?: string, playerId?: string, nick: string, at: number }
/** кто-то в комнате или профиле: те же признаки */
export interface WhoIs { userId?: string, playerId?: string, nick?: string }

export const BLACKLIST_LIMIT = 5;
export const BLACKLIST_LIMIT_PREMIUM = 15;
export const blacklistLimit = (premium: boolean) => premium ? BLACKLIST_LIMIT_PREMIUM : BLACKLIST_LIMIT;

/** это тот же игрок: совпал id пользователя, id игрока или ник (без учёта регистра и пробелов) */
export function sameWho(entry: BlackEntry, who: WhoIs): boolean {
  if(entry.userId && who.userId && entry.userId == who.userId) return true;
  if(entry.playerId && who.playerId && entry.playerId == who.playerId) return true;
  return !!who.nick && !!entry.nick && nickKey(entry.nick) == nickKey(who.nick);
}

export const isBlacklisted = (list: readonly BlackEntry[], who: WhoIs) => list.some(entry => sameWho(entry, who));

/** добавить игрока; дубль и переполнение - отказ. Новые сведения (id) у уже записанного ника дополняют запись */
export function addToBlacklist(list: readonly BlackEntry[], who: WhoIs, limit: number, now = Date.now()): { list: BlackEntry[] } | { error: "limit" | "exists" | "empty" } {
  const nick = (who.nick ?? "").trim();
  if(!nick && !who.userId && !who.playerId) return { error: "empty" };
  if(isBlacklisted(list, who)) return { error: "exists" };
  if(list.length >= limit) return { error: "limit" };
  return { list: [...list, { ...(who.userId ? { userId: who.userId } : {}), ...(who.playerId ? { playerId: who.playerId } : {}), nick: nick || "Игрок", at: now }] };
}

export const removeFromBlacklist = (list: readonly BlackEntry[], who: WhoIs): BlackEntry[] => list.filter(entry => !sameWho(entry, who));

/** список с сервера приводится к допустимому: нужные поля, не больше лимита */
export function cleanBlacklist(raw: unknown, limit: number): BlackEntry[] {
  if(!Array.isArray(raw)) return [];
  const result: BlackEntry[] = [];
  for(const item of raw) {
    if(typeof item != "object" || item === null) continue;
    const { userId, playerId, nick, at } = item as Record<string, unknown>;
    if(typeof nick != "string" || !nick.trim()) continue;
    result.push({ ...(typeof userId == "string" && userId ? { userId: userId.slice(0, 64) } : {}), ...(typeof playerId == "string" && playerId ? { playerId: playerId.slice(0, 64) } : {}), nick: nick.slice(0, 32), at: typeof at == "number" ? at : 0 });
    if(result.length >= limit) break;
  }
  return result;
}
