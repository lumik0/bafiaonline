import type { RoomSession } from "./domain/room/session";

/** экраны игры и их параметры */
export type Routes = {
  /** текст ожидания меняется отдельно (в app.ts), чтобы экран не пересоздавался и не мерцал */
  loading: {}
  authorization: { email?: string, error?: string }
  menu: {}
  settings: {}
  theme: {}
  friends: {}
  globalChat: {}
  rooms: {}
  history: {}
  backpack: {}
  rules: {}
  ratings: {}
  shop: {}
  mods: {}
  competitive: {}
  roomCreation: {}
  /** игровая комната: сессия создаётся при входе и подписана на пакеты ещё до показа экрана */
  room: { session: RoomSession }
  privateChat: { friendshipId: string, playerObjectId: string, username: string, photo?: string }
};
