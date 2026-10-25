/**
 * протокол сервера Бафии: статистика и «кто играет»; сервер закрытый, описание публичное
 * клиент и сервер проверяют сообщения одним кодом; авторизации нет, клиент - случайный ключ
 * (он не связан с аккаунтом игры), а ник и id игрока - просто сведения, которым сервер не верит на слово
 */
export const BAFIA_PROTOCOL_VERSION = 1;

/** ограничения: без авторизации сервер защищается размерами и частотой */
export const BAFIA_LIMITS = {
  /** размер одного сообщения, байт */
  message: 8 * 1024,
  /** сколько игроков в одном запросе «кто в Бафии» / «увидел» */
  players: 40,
  key: { min: 16, max: 64 },
  nick: 32,
  id: 64,
  /** длина поискового запроса по гифкам */
  query: 40,
  /** размер снимка игры (байт), сколько снимков хранить и сколько дней; у премиума больше */
  history: 300 * 1024,
  historyPerClient: 20,
  historyDays: 30,
  premiumHistory: 900 * 1024,
  premiumHistoryPerClient: 100,
  premiumHistoryDays: 180,
  /** код премиума: длина записи, на скольких устройствах можно активировать */
  code: 32,
  codeDevices: 3,
  /** загрузка гифки: размер файла, очередь проверки и лимит загрузок в сутки */
  gifBytes: 3 * 1024 * 1024,
  gifPending: 10,
  gifPerDay: 20,
  gifTitle: 80
} as const;

/** файл лежит на сервере Бафии; `url` - путь `/g/номер` */
export const GIF_FILE_PATH = /^\/g\/[a-z0-9]{6,12}$/;

/** цвета значка премиума: название → цвет (сервер присылает только название) */
export const PREMIUM_COLORS = {
  gold: "#E0A800", red: "#E5484D", pink: "#E93D82", purple: "#8E4EC6", blue: "#3E63DD", cyan: "#12A594", green: "#30A46C", orange: "#F76B15"
} as const;
export type PremiumColor = keyof typeof PREMIUM_COLORS;
export const isPremiumColor = (value: unknown): value is PremiumColor => typeof value == "string" && Object.hasOwn(PREMIUM_COLORS, value);

/** ссылка на историю игры в личном сообщении: `[hist:номер]` */
export const HIST_TAG = /^\[hist:([a-z0-9]{12})\]$/;
export const HIST_ID = /^[a-z0-9]{12}$/;

/** номер гифки в сообщении: `[gif:abc123]` */
export const GIF_ID = /^[A-Za-z0-9_-]{1,40}$/;
export const GIF_TAG = /^\[gif:([A-Za-z0-9_-]{1,40})\]$/;

/** гифка из поиска Giphy: номер `g_` + id на Giphy; адрес строится по нему, ключ для показа не нужен */
export const GIPHY_PREFIX = "g_";
export const giphyUrl = (giphyId: string, size: "giphy" | "200w" = "giphy") => `https://media.giphy.com/media/${giphyId}/${size}.gif`;
export const giphyIdOf = (id: string) => id.startsWith(GIPHY_PREFIX) && /^[A-Za-z0-9]{5,30}$/.test(id.slice(GIPHY_PREFIX.length)) ? id.slice(GIPHY_PREFIX.length) : undefined;

/** гифки грузятся только с этих сайтов: сообщение не откроет чужой адрес */
export const GIF_HOSTS = ["tenor.com", "giphy.com", "i.imgur.com"] as const;

/** ссылка подходит для каталога: https, без логина и пароля, хост из списка */
export function isGifUrl(value: string): boolean {
  if(value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol == "https:" && !url.username && !url.password
      && GIF_HOSTS.some(host => url.hostname == host || url.hostname.endsWith("." + host));
  } catch {
    return false;
  }
}

/** результат партии: победил ли игрок; `undefined`, если неизвестно */
export interface PlayedEvent { won?: boolean }

export interface SeenPlayer { id: string, nick: string }

/** сообщения клиента; `n` - номер запроса, ответ приходит с тем же номером */
export type ClientMessage =
  /** войти в сеть: ключ клиента и версия протокола */
  | { t: "hello", n: number, key: string, version: number }
  /** «Я играю под этим ником»: появляется в списке «в Бафии» до закрытия соединения */
  | { t: "presence", n: number, id: string, nick: string }
  /** кто из этих игроков сейчас в Бафии */
  | { t: "who", n: number, ids: string[] }
  /** сыграна партия */
  | { t: "played", n: number, won?: boolean }
  /** эти игроки замечены под такими никами (из комнат, чатов и профилей) */
  | { t: "seen", n: number, players: SeenPlayer[] }
  /** история ников игрока */
  | { t: "nicks", n: number, id: string }
  /** адрес гифки из сообщения `[gif:id]` */
  | { t: "gif", n: number, id: string }
  /** поиск гифок в каталоге; пустой запрос - последние добавленные */
  | { t: "gifs", n: number, query: string }
  /** предложить гифку в каталог: gif или webp в base64, после проверки администратором */
  | { t: "gifUpload", n: number, title: string, data: string }
  /** цвет значка премиума (только с премиумом) */
  | { t: "style", n: number, color: string }
  /** статус премиума и мои загрузки */
  | { t: "premium", n: number }
  /** активировать код премиума (выдаётся за донат) на этой установке */
  | { t: "redeem", n: number, code: string }
  /** мои загрузки (гифки и стикеры) со статусом проверки */
  | { t: "mine", n: number }
  /** выложить снимок игры (JSON строкой) и получить номер для ссылки `[hist:номер]` */
  | { t: "histPut", n: number, data: string }
  /** получить снимок по номеру из ссылки */
  | { t: "histGet", n: number, id: string };

/** гифка каталога: готовая ссылка на разрешённый хост */
export interface GifItem {
  id: string
  url: string
  title: string
  /** уменьшенная копия для сетки выбора; нет - показываем саму гифку */
  thumb?: string
}

export interface NickRecord { nick: string, first: number, last: number }

export type ServerMessage =
  /** на `hello` сервер может добавить ключ Giphy: поиск гифок игрок делает сам, из своего браузера */
  | { t: "ok", n: number, gifKey?: string, premium?: number }
  | { t: "error", n: number, reason: string }
  | { t: "online", n: number, ids: string[], premium?: string[], colors?: Record<string, string> }
  | { t: "nicks", n: number, id: string, names: NickRecord[] }
  /** `url` нет, если такой гифки в каталоге нет */
  | { t: "gif", n: number, id: string, url?: string, title?: string }
  | { t: "gifs", n: number, items: GifItem[] }
  /** до какого времени (мс) действует премиум; нет - не действует */
  | { t: "premium", n: number, until?: number }
  | { t: "mine", n: number, items: (GifItem & { status: "pending" | "approved" })[] }
  /** ответ на выкладывание (`id`) или на получение (`data`; нет - снимка нет или он устарел) */
  | { t: "hist", n: number, id: string, data?: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value == "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): value is string => typeof value == "string" && value.length > 0 && value.length <= max;

/** идентификаторы и ники сохраняются в базе: никаких управляющих символов */
const clean = (value: string) => !/[\u0000-\u001f\u007f]/.test(value);

function player(value: unknown): SeenPlayer | undefined {
  if(!isRecord(value) || !text(value.id, BAFIA_LIMITS.id) || !text(value.nick, BAFIA_LIMITS.nick)) return undefined;
  return clean(value.id) && clean(value.nick) ? { id: value.id, nick: value.nick } : undefined;
}

function ids(value: unknown): string[] | undefined {
  if(!Array.isArray(value) || value.length > BAFIA_LIMITS.players) return undefined;
  return value.every(id => text(id, BAFIA_LIMITS.id) && clean(id)) ? value as string[] : undefined;
}

/** разбирает сообщение клиента; всё, что не подходит, - `undefined` (сервер такое просто отбрасывает) */
export function parseClientMessage(raw: string): ClientMessage | undefined {
  // снимок игры и гифка большие, остальные сообщения нет; размер проверяется ещё раз по типу ниже
  if(raw.length > Math.ceil(BAFIA_LIMITS.gifBytes * 4 / 3) + 1000) return undefined;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return undefined; }
  if(!isRecord(value) || typeof value.n != "number" || !Number.isSafeInteger(value.n)) return undefined;
  const n = value.n;
  if(value.t != "histPut" && value.t != "gifUpload" && raw.length > BAFIA_LIMITS.message) return undefined;
  if(value.t == "histPut" && raw.length > BAFIA_LIMITS.premiumHistory + 200) return undefined;

  switch(value.t) {
    case "hello":
      return text(value.key, BAFIA_LIMITS.key.max) && value.key.length >= BAFIA_LIMITS.key.min && typeof value.version == "number"
        ? { t: "hello", n, key: value.key, version: value.version } : undefined;
    case "presence": {
      const self = player({ id: value.id, nick: value.nick });
      return self && { t: "presence", n, ...self };
    }
    case "who": {
      const list = ids(value.ids);
      return list && { t: "who", n, ids: list };
    }
    case "played":
      return value.won === undefined || typeof value.won == "boolean" ? { t: "played", n, won: value.won } : undefined;
    case "seen": {
      if(!Array.isArray(value.players) || value.players.length > BAFIA_LIMITS.players) return undefined;
      const players = value.players.map(player);
      return players.every(Boolean) ? { t: "seen", n, players: players as SeenPlayer[] } : undefined;
    }
    case "gif":
      return typeof value.id == "string" && GIF_ID.test(value.id) ? { t: "gif", n, id: value.id } : undefined;
    case "gifUpload":
      return typeof value.title == "string" && value.title.length <= BAFIA_LIMITS.gifTitle && clean(value.title) && typeof value.data == "string" && value.data.length > 20 && /^[A-Za-z0-9+/=]+$/.test(value.data)
        ? { t: "gifUpload", n, title: value.title, data: value.data } : undefined;
    case "style":
      return isPremiumColor(value.color) ? { t: "style", n, color: value.color } : undefined;
    case "premium": return { t: "premium", n };
    case "mine": return { t: "mine", n };
    case "redeem":
      return typeof value.code == "string" && /^[A-Za-z0-9-]{6,32}$/.test(value.code) ? { t: "redeem", n, code: value.code.toUpperCase() } : undefined;
    case "histPut":
      return typeof value.data == "string" && value.data.length > 2 && value.data.length <= BAFIA_LIMITS.premiumHistory ? { t: "histPut", n, data: value.data } : undefined;
    case "histGet":
      return typeof value.id == "string" && HIST_ID.test(value.id) ? { t: "histGet", n, id: value.id } : undefined;
    case "gifs":
      return typeof value.query == "string" && value.query.length <= BAFIA_LIMITS.query && clean(value.query) ? { t: "gifs", n, query: value.query } : undefined;
    case "nicks":
      return text(value.id, BAFIA_LIMITS.id) && clean(value.id) ? { t: "nicks", n, id: value.id } : undefined;
    default:
      return undefined;
  }
}
