import type { GameSettings } from "@common/storage";

/** сколько помним пароль комнаты: комнаты живут недолго, а пароль лежать вечно не должен */
export const ROOM_PASSWORD_TTL = 24 * 3_600_000;
/** сколько комнат помним сразу */
export const ROOM_PASSWORD_MAX = 30;

type Store = { data: Pick<GameSettings, "roomPasswords">, update(change: (data: GameSettings) => void): unknown };

/** сохранённый (хеш) пароль комнаты, в которую игрок уже входил; устаревший не возвращается */
export function savedRoomPassword(settings: Pick<Store, "data">, roomId: string, now = Date.now()): string | undefined {
  const entry = settings.data.roomPasswords[roomId];
  return entry && now - entry.at < ROOM_PASSWORD_TTL ? entry.hash : undefined;
}

/** запомнить, что в эту комнату вошли с таким паролем; хранится хеш, как его принимает сервер, сам пароль не хранится */
export function rememberRoomPassword(settings: Store, roomId: string, hash: string, now = Date.now()) {
  if(!roomId || !hash) return;
  settings.update(data => {
    const fresh = Object.entries(data.roomPasswords).filter(([id, entry]) => id != roomId && now - entry.at < ROOM_PASSWORD_TTL);
    fresh.sort((a, b) => b[1].at - a[1].at);
    data.roomPasswords = Object.fromEntries([[roomId, { hash, at: now }], ...fresh.slice(0, ROOM_PASSWORD_MAX - 1)]);
  });
}

/** пароль не подошёл или комнаты больше нет: забываем */
export function forgetRoomPassword(settings: Store, roomId: string) {
  if(!(roomId in settings.data.roomPasswords)) return;
  settings.update(data => { delete data.roomPasswords[roomId]; });
}
