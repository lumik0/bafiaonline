import { JsonDocument } from "./document";
import type { FileStore } from "./files";

export const SETTINGS_VERSION = 6;

export const defaultGameSettings = (mobile: boolean) => ({
  version: SETTINGS_VERSION,
  debug: false,
  developer: false,
  hideUsername: false,
  /** весь интерфейс с маленькой буквы (ники, сообщения и названия комнат не меняются) */
  lowercase: false,
  /** заглушенные игроки (постоянный `objectId` пользователя, `playerObjectId` в каждой игре новый): их сообщения в чатах не показываются */
  muted: [] as string[],
  /** сервер Бафии: только с согласия; `key` - случайный ключ установки, с аккаунтом не связан */
  bafia: {
    enabled: false,
    /** игрока уже спросили (окно при первом заходе) */
    asked: false,
    key: "",
    /** код премиума: по нему премиум возвращается после потери данных сервера */
    code: "",
    /** цвет значка премиума (название из PREMIUM_COLORS) */
    color: "gold"
  },
  window: {
    zoom: 1
  },
  game: {
    widthPL: 130,
    zoomPL: 1,
    showYouDiedMessage: true,
    saveHistory: true,
    /** опыт: спрашивать заявки в друзья во время игры (`gsfrl`); может сбить подписку, выключено */
    pollRequests: false,
    clearMessages: true,
    showIndexPl: false,
    showIndexPlChat: false,
    barmanEffect: "!"
  },
  roomCreate: {
    title: "",
    dayTime: 0,
    minPlayers: 5,
    maxPlayers: 8,
    minLevel: 1,
    selectedRoles: [6, 9, 11, 2, 5, 7, 8, 10],
    password: "",
    vip: false
  }
});

export type GameSettings = ReturnType<typeof defaultGameSettings>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value == "object" && value !== null && !Array.isArray(value);

/** сохранённые значения побеждают, недостающие берём из значений по умолчанию */
function mergeDefaults<T>(defaults: T, saved: unknown): T {
  if(!isRecord(defaults) || !isRecord(saved)) return (saved === undefined || typeof saved != typeof defaults ? defaults : saved) as T;

  const result: Record<string, unknown> = { ...saved };
  for(const key of Object.keys(defaults)) result[key] = mergeDefaults(defaults[key], saved[key]);
  return result as T;
}

/** путь зависит от версии игры в старом коде: `${config.path}/settings.json`, по умолчанию `/game` */
export const gameSettings = (files: FileStore, mobile: boolean, path = "/game/settings.json") =>
  new JsonDocument<GameSettings>(files, {
    path,
    defaults: () => defaultGameSettings(mobile),
    migrate: raw => {
      const settings = { ...mergeDefaults(defaultGameSettings(mobile), raw), version: SETTINGS_VERSION };
      // старая версия на телефоне ставила масштаб 0.6 сама (всё мелкое); при переносе возвращаем обычный
      if(mobile && settings.window.zoom == .6) settings.window.zoom = 1;
      return settings;
    }
  });
