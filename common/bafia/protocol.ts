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
  /** загрузка гифки (для всех игроков, без премиума - после проверки): размер файла, очередь проверки и лимит загрузок в сутки */
  gifBytes: 16 * 1024 * 1024,
  gifPending: 3,
  gifPerDay: 5,
  /** пауза между загрузками (мс) у игрока без премиума */
  gifCooldown: 60_000,
  /** премиум: проверки нет (гифка сразу в каталоге), лимиты намного мягче */
  premiumGifPerDay: 40,
  premiumGifCooldown: 3_000,
  gifTitle: 80,
  /** аватарка (для всех игроков): размер файла, сколько раз в сутки можно менять, длинная сторона после сжатия (px) */
  avatarBytes: 16 * 1024 * 1024,
  avatarPerDay: 10,
  avatarSide: 256,
  /** баннер профиля (премиум): размер файла, сколько раз в сутки можно менять, длинная сторона после сжатия (px) */
  bannerBytes: 16 * 1024 * 1024,
  bannerPerDay: 10,
  bannerSide: 960,
  /** статус в профиле (премиум): длина */
  status: 60,
  /** сообщение всем игрокам от администратора: длина текста */
  notice: 300,
  /** идея, баг, предложение или ответ на сообщение администратора: длина текста, пауза между отправками (мс) и сколько в сутки с одной установки */
  feedback: 1000,
  feedbackCooldown: 20_000,
  feedbackPerDay: 10,
  /** отчёт о краше игры: длина текста */
  crash: 60_000,
  /** мод на проверку: суммарный размер кода и исходников (символов), отправок в сутки с одной установки */
  modBytes: 2 * 1024 * 1024,
  modPerDay: 5
} as const;

/** что игрок отправил администратору: ответ на сообщение всем или запись из экрана «Идеи и баги» */
export const FEEDBACK_KINDS = ["reply", "idea", "bug", "suggestion"] as const;
export type FeedbackKind = typeof FEEDBACK_KINDS[number];

/** файл лежит на сервере Бафии; `url` - путь `/g/номер` */
export const GIF_FILE_PATH = /^\/g\/[a-z0-9]{6,12}$/;

/** аватарка лежит на сервере Бафии; путь `/a/номер` */
export const AVATAR_FILE_PATH = /^\/a\/[a-z0-9]{6,12}$/;

/** баннер профиля лежит на сервере Бафии; путь `/b/номер` */
export const BANNER_FILE_PATH = /^\/b\/[a-z0-9]{6,12}$/;
/** свой цвет фона профиля (премиум): #rrggbb; пустая строка - цвет не задан */
export const PROFILE_BG = /^#[0-9a-fA-F]{6}$/;

/** цвета значка премиума: название → цвет (сервер присылает только название) */
export const PREMIUM_COLORS = {
  gold: "#E0A800", red: "#E5484D", pink: "#E93D82", purple: "#8E4EC6", blue: "#3E63DD", cyan: "#12A594", green: "#30A46C", orange: "#F76B15",
  lime: "#8DB600", sky: "#2D9CDB", indigo: "#5B5BD6", crimson: "#B5173D", magenta: "#C026D3", brown: "#8B5E3C", mint: "#3DD6A0", gray: "#6B7280"
} as const;
export type PremiumColor = keyof typeof PREMIUM_COLORS;
export const isPremiumColor = (value: unknown): value is PremiumColor => typeof value == "string" && Object.hasOwn(PREMIUM_COLORS, value);

/** эффекты ника (премиум): цвет берётся из цвета значка */
export const PROFILE_EFFECTS = ["gradient", "rainbow"] as const;
export type ProfileEffect = typeof PROFILE_EFFECTS[number];
/** готовые темы фона профиля (премиум): название -> CSS-градиент */
export const PROFILE_THEMES = {
  sunset: "linear-gradient(135deg, #ff9966, #ff5e62)",
  ocean: "linear-gradient(135deg, #2193b0, #6dd5ed)",
  forest: "linear-gradient(135deg, #134e5e, #71b280)",
  night: "linear-gradient(135deg, #232526, #414345)",
  candy: "linear-gradient(135deg, #ee9ca7, #ffdde1)",
  violet: "linear-gradient(135deg, #5f2c82, #49a09d)",
  peach: "linear-gradient(135deg, #ffecd2, #fcb69f)",
  mint: "linear-gradient(135deg, #a8edea, #fed6e3)",
  gold: "linear-gradient(135deg, #f7971e, #ffd200)",
  fire: "linear-gradient(135deg, #b91d1d, #f5af19)",
  aurora: "linear-gradient(135deg, #00c9ff, #92fe9d)",
  cherry: "linear-gradient(135deg, #8e0e00, #e55d87)"
} as const;
/** темы со светлым фоном: на них тёмный текст */
export const LIGHT_THEMES: readonly string[] = ["sunset", "candy", "peach", "mint", "gold", "aurora"];
export type ProfileTheme = keyof typeof PROFILE_THEMES;

/** внешний вид профиля игрока с премиумом (кроме баннера и цвета фона) */
export interface ProfileLook {
  /** короткая строка под ником */
  status?: string
  /** цвет рамки аватарки (название из PREMIUM_COLORS) */
  frame?: PremiumColor
  effect?: ProfileEffect
  theme?: ProfileTheme
  /** номер закреплённой гифки */
  pin?: string
}

/** разбирает и чистит внешний вид профиля; чужие поля отбрасывает, пустое даёт `{}` */
export function parseLook(value: unknown): ProfileLook {
  const look: ProfileLook = {};
  if(!isRecord(value)) return look;
  if(typeof value.status == "string") {
    const status = value.status.trim();
    if(status && status.length <= BAFIA_LIMITS.status && clean(status)) look.status = status;
  }
  if(isPremiumColor(value.frame)) look.frame = value.frame;
  if(typeof value.effect == "string" && (PROFILE_EFFECTS as readonly string[]).includes(value.effect)) look.effect = value.effect as ProfileEffect;
  if(typeof value.theme == "string" && Object.hasOwn(PROFILE_THEMES, value.theme)) look.theme = value.theme as ProfileTheme;
  if(typeof value.pin == "string" && GIF_ID.test(value.pin)) look.pin = value.pin;
  return look;
}

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

/** с какого устройства играют (грубо, для статистики): ничего, кроме этого списка, сервер не принимает */
export const PLATFORMS = ["ios", "android", "windows", "macos", "linux", "other"] as const;
export type Platform = typeof PLATFORMS[number];
/** в каком браузере играют (грубо, для статистики) */
export const BROWSERS = ["chrome", "safari", "firefox", "edge", "opera", "samsung", "yandex", "other"] as const;
export type Browser = typeof BROWSERS[number];
export const isBrowser = (value: unknown): value is Browser => typeof value == "string" && (BROWSERS as readonly string[]).includes(value);
/** с какой ссылки открыта игра: только адрес сайта (хост), без пути и параметров */
export const isSite = (value: unknown): value is string => typeof value == "string" && /^[a-z0-9]([a-z0-9.-]{0,58}[a-z0-9])?(:\d{1,5})?$/.test(value);

export const isPlatform = (value: unknown): value is Platform => typeof value == "string" && (PLATFORMS as readonly string[]).includes(value);

/** ключ для сравнения ников: без различия регистра и лишних пробелов (в игре ник уникален, но пишут его по-разному); одинаков у клиента и сервера */
export const nickKey = (nick: string) => nick.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/** результат партии: победил ли игрок; `undefined`, если неизвестно */
export interface PlayedEvent { won?: boolean }

export interface SeenPlayer { id: string, nick: string }

/** сообщения клиента; `n` - номер запроса, ответ приходит с тем же номером */
export type ClientMessage =
  /** проверка связи: сервер сразу отвечает `ok` (браузер сам пинг-кадры слать не умеет) */
  | { t: "ping", n: number }
  /** войти в сеть: ключ клиента и версия протокола */
  | { t: "hello", n: number, key: string, version: number }
  /** «Я играю под этим ником»: появляется в списке «в Бафии» до закрытия соединения */
  | { t: "presence", n: number, id: string, nick: string, platform?: Platform, version?: string, browser?: Browser, site?: string }
  /** кто из этих игроков сейчас в Бафии */
  | { t: "who", n: number, ids: string[] }
  /** значки «Позор» и «БАН» по никам (игрок может быть и не в сети): друзья, чат, комната, профиль */
  | { t: "marks", n: number, nicks: string[] }
  /** игра не пустила этого игрока при входе (бан): `seconds` - сколько осталось по словам официального сервера */
  | { t: "banned", n: number, id: string, nick: string, seconds: number }
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
  /** своя аватарка: gif, webp или png в base64; видна другим игрокам Бафии сразу */
  | { t: "avatarSet", n: number, data: string }
  /** убрать свою аватарку */
  | { t: "avatarClear", n: number }
  /** баннер профиля (только премиум): gif, webp или png в base64; видят игроки Бафии в твоём профиле */
  | { t: "bannerSet", n: number, data: string }
  | { t: "bannerClear", n: number }
  /** свой цвет фона профиля (только премиум): `#rrggbb` или пустая строка, чтобы убрать */
  | { t: "profileBg", n: number, color: string }
  /** внешний вид профиля (только премиум): заменяет прежний целиком, пустой - всё убрать */
  | { t: "look", n: number, look: ProfileLook }
  /** пожаловаться на баннер или аватарку игрока, который сейчас в сети (по id игрока) */
  | { t: "report", n: number, id: string, kind: "banner" | "avatar" }
  /** кто из этих ников сейчас в Бафии (для избранных игроков, до 20 ников) */
  | { t: "whoNicks", n: number, nicks: string[] }
  /** статус премиума и мои загрузки */
  | { t: "premium", n: number }
  /** активировать код премиума (выдаётся за донат) на этой установке */
  | { t: "redeem", n: number, code: string }
  /** мои загрузки (гифки и стикеры) со статусом проверки */
  | { t: "mine", n: number }
  /** выложить снимок игры (JSON строкой) и получить номер для ссылки `[hist:номер]` */
  | { t: "histPut", n: number, data: string }
  /** получить снимок по номеру из ссылки */
  | { t: "histGet", n: number, id: string }
  /** идея, баг, предложение или ответ (`reply`) на сообщение администратора (`notice` - сообщение всем, `direct` - личное) */
  /** отчёт о краше игры (текст без трафика и сообщений): уходит сам */
  | { t: "crash", n: number, text: string }
  /** мод на проверку: файл мода (манифест, код, исходники, подпись автора); отправить может только подписавший автор */
  | { t: "modSubmit", n: number, pack: Record<string, unknown> }
  /** мои обращения со статусом */
  | { t: "myFeedback", n: number }
  /** сколько я провёл в Бафии (по моему нику): время, дней и с какого дня считается */
  | { t: "myStats", n: number }
  /** какие экраны и функции открывались: название -> сколько раз (пачкой, только счётчики) */
  | { t: "usage", n: number, counts: Record<string, number> }
  | { t: "feedback", n: number, kind: FeedbackKind, text: string, notice?: number, direct?: number };

/** гифка каталога: готовая ссылка на разрешённый хост */
export interface GifItem {
  id: string
  url: string
  title: string
  /** уменьшенная копия для сетки выбора; нет - показываем саму гифку */
  thumb?: string
}

/** обращение игрока: `sent` - отправлено, `answered` - администратор ответил лично, `done` - разобрано */
export type FeedbackStatus = "sent" | "answered" | "done";
export interface FeedbackItem { id: number, kind: FeedbackKind, text: string, created: number, status: FeedbackStatus }

/** название экрана или функции для статистики использования: латиница, цифры и `.:_-` */
export const USAGE_KEY = /^[a-z][A-Za-z0-9:._-]{0,39}$/;

export interface NickRecord { nick: string, first: number, last: number }

export type ServerMessage =
  /** на `hello` сервер может добавить ключ Giphy: поиск гифок игрок делает сам, из своего браузера */
  /** `avatar` - путь моей аватарки (`/a/номер`) в ответе на hello, avatarSet и avatarClear; нет - аватарки нет */
  | { t: "ok", n: number, /** гифка опубликована сразу (премиум), а не ушла на проверку */ approved?: boolean, gifKey?: string, premium?: number, avatar?: string, banner?: string, profileBg?: string, look?: ProfileLook }
  /** одноразовое сообщение администратора всем, кто сейчас в сети (приходит само, `n` всегда 0); позже зашедшие его не получают */
  /** сообщение администратора; `id` (сообщение всем) или `direct` (личное, только тебе) нужны, чтобы на него можно было ответить */
  | { t: "notice", n: 0, text: string, id?: number, direct?: number }
  | { t: "error", n: number, reason: string }
  /** `avatars` - пути аватарок игроков (id → `/a/номер`) */
  /** `banners` - пути баннеров профиля (id → `/b/номер`), `backs` - цвета фона профиля; только у игроков с премиумом */
  | { t: "online", n: number, ids: string[], premium?: string[], colors?: Record<string, string>, avatars?: Record<string, string>, banners?: Record<string, string>, backs?: Record<string, string>, looks?: Record<string, ProfileLook> }
  /** ключ - `nickKey` ника; `shame` - очки «Позора» у тех, кому положен значок; `bans` - до какого времени (мс) действует бан; у остальных записи нет */
  /** ключи (`nickKey`) ников из `whoNicks`, которые сейчас в сети */
  | { t: "onlineNicks", n: number, nicks: string[] }
  | { t: "marks", n: number, shame?: Record<string, number>, bans?: Record<string, number> }
  | { t: "nicks", n: number, id: string, names: NickRecord[] }
  /** мои обращения (последние 30) со статусом */
  | { t: "myFeedback", n: number, items: FeedbackItem[] }
  /** `seconds` - время в Бафии, `days` - в сколько разных дней играл, `since` - первый день (ГГГГ-ММ-ДД); `since` нет, если ещё не считалось */
  | { t: "myStats", n: number, seconds: number, days: number, since?: string }
  /** `url` нет, если такой гифки в каталоге нет */
  | { t: "gif", n: number, id: string, url?: string, title?: string }
  | { t: "gifs", n: number, items: GifItem[] }
  /** до какого времени (мс) действует премиум; нет - не действует */
  /** ответ на premium/redeem; без запроса (`n` 0) приходит, когда премиум включили: `code` игра сохраняет, чтобы он вернулся и на новой установке */
  | { t: "premium", n: number, until?: number, code?: string }
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
  // большое сообщение допустимо только трёх типов: тип стоит в начале, поэтому лишнее отбрасываем до разбора JSON (иначе поток мусора по 20 МБ грузил бы процессор)
  if(raw.length > BAFIA_LIMITS.message && !/"t":\s*"(histPut|gifUpload|avatarSet|bannerSet|crash|modSubmit)"/.test(raw.slice(0, 200))) return undefined;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return undefined; }
  if(!isRecord(value) || typeof value.n != "number" || !Number.isSafeInteger(value.n)) return undefined;
  const n = value.n;
  if(value.t != "histPut" && value.t != "gifUpload" && value.t != "avatarSet" && value.t != "bannerSet" && value.t != "crash" && value.t != "modSubmit" && raw.length > BAFIA_LIMITS.message) return undefined;
  if(value.t == "modSubmit" && raw.length > BAFIA_LIMITS.modBytes * 2 + 4000) return undefined;
  if(value.t == "crash" && raw.length > BAFIA_LIMITS.crash * 2 + 200) return undefined;
  if(value.t == "avatarSet" && raw.length > Math.ceil(BAFIA_LIMITS.avatarBytes * 4 / 3) + 1000) return undefined;
  if(value.t == "bannerSet" && raw.length > Math.ceil(BAFIA_LIMITS.bannerBytes * 4 / 3) + 1000) return undefined;
  if(value.t == "histPut" && raw.length > BAFIA_LIMITS.premiumHistory + 200) return undefined;

  switch(value.t) {
    case "ping": return { t: "ping", n };
    case "hello":
      return text(value.key, BAFIA_LIMITS.key.max) && value.key.length >= BAFIA_LIMITS.key.min && typeof value.version == "number"
        ? { t: "hello", n, key: value.key, version: value.version } : undefined;
    case "presence": {
      const self = player({ id: value.id, nick: value.nick });
      return self && { t: "presence", n, ...self, platform: isPlatform(value.platform) ? value.platform : undefined, browser: isBrowser(value.browser) ? value.browser : undefined, site: isSite(value.site) ? value.site : undefined, version: typeof value.version == "string" && /^[A-Za-z0-9._ -]{1,20}$/.test(value.version) ? value.version : undefined };
    }
    case "banned": {
      const self = player({ id: value.id, nick: value.nick });
      return self && typeof value.seconds == "number" && Number.isFinite(value.seconds) && value.seconds > 0 && value.seconds <= 366 * 86_400
        ? { t: "banned", n, ...self, seconds: Math.ceil(value.seconds) } : undefined;
    }
    case "who": {
      const list = ids(value.ids);
      return list && { t: "who", n, ids: list };
    }
    case "marks": {
      if(!Array.isArray(value.nicks) || value.nicks.length > BAFIA_LIMITS.players) return undefined;
      return value.nicks.every(nick => text(nick, BAFIA_LIMITS.nick) && clean(nick)) ? { t: "marks", n, nicks: value.nicks as string[] } : undefined;
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
    case "avatarSet":
      return typeof value.data == "string" && value.data.length > 20 && /^[A-Za-z0-9+/=]+$/.test(value.data) ? { t: "avatarSet", n, data: value.data } : undefined;
    case "avatarClear": return { t: "avatarClear", n };
    case "bannerSet":
      return typeof value.data == "string" && value.data.length > 20 && /^[A-Za-z0-9+/=]+$/.test(value.data) ? { t: "bannerSet", n, data: value.data } : undefined;
    case "bannerClear": return { t: "bannerClear", n };
    case "profileBg":
      return typeof value.color == "string" && (value.color == "" || PROFILE_BG.test(value.color)) ? { t: "profileBg", n, color: value.color.toLowerCase() } : undefined;
    case "look": return { t: "look", n, look: parseLook(value.look) };
    case "report":
      return text(value.id, BAFIA_LIMITS.id) && clean(value.id) && (value.kind == "banner" || value.kind == "avatar") ? { t: "report", n, id: value.id, kind: value.kind as "banner" | "avatar" } : undefined;
    case "whoNicks": {
      const nicks = Array.isArray(value.nicks) ? value.nicks.filter((nick): nick is string => text(nick, BAFIA_LIMITS.nick) && clean(nick)) : [];
      return Array.isArray(value.nicks) && value.nicks.length <= 20 && nicks.length == value.nicks.length ? { t: "whoNicks", n, nicks } : undefined;
    }
    case "premium": return { t: "premium", n };
    case "mine": return { t: "mine", n };
    case "myFeedback": return { t: "myFeedback", n };
    case "myStats": return { t: "myStats", n };
    case "usage": {
      if(!isRecord(value.counts)) return undefined;
      const entries = Object.entries(value.counts);
      if(!entries.length || entries.length > 60) return undefined;
      const counts: Record<string, number> = {};
      for(const [key, count] of entries) {
        if(!USAGE_KEY.test(key) || typeof count != "number" || !Number.isInteger(count) || count < 1 || count > 1000) return undefined;
        counts[key] = count;
      }
      return { t: "usage", n, counts };
    }
    case "redeem":
      return typeof value.code == "string" && /^[A-Za-z0-9-]{6,32}$/.test(value.code) ? { t: "redeem", n, code: value.code.toUpperCase() } : undefined;
    case "histPut":
      return typeof value.data == "string" && value.data.length > 2 && value.data.length <= BAFIA_LIMITS.premiumHistory ? { t: "histPut", n, data: value.data } : undefined;
    case "modSubmit":
      return isRecord(value.pack) && !Array.isArray(value.pack) ? { t: "modSubmit", n, pack: value.pack } : undefined;
    case "crash":
      return typeof value.text == "string" && value.text.trim().length > 0 && value.text.length <= BAFIA_LIMITS.crash && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.text) ? { t: "crash", n, text: value.text } : undefined;
    case "feedback": {
      const body = typeof value.text == "string" ? value.text.trim() : "";
      if(!body || body.length > BAFIA_LIMITS.feedback || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(body)) return undefined;
      if(!(FEEDBACK_KINDS as readonly unknown[]).includes(value.kind)) return undefined;
      const id = (field: unknown) => typeof field == "number" && Number.isSafeInteger(field) && field > 0 ? field : undefined;
      const notice = id(value.notice), direct = id(value.direct);
      // ответ без сообщения, на которое отвечают, бессмыслен, и отвечают на одно сообщение, а не на два
      if(value.kind == "reply" && notice === undefined && direct === undefined) return undefined;
      if(notice !== undefined && direct !== undefined) return undefined;
      return { t: "feedback", n, kind: value.kind as FeedbackKind, text: body, ...(notice !== undefined ? { notice } : {}), ...(direct !== undefined ? { direct } : {}) };
    }
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
