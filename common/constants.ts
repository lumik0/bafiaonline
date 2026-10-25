/** сервер Мафии онлайн */
export const SERVER_URL = "wss://dottap.com:7091";
/** запасные адреса того же сервера: если один не отвечает, пробуем следующий */
export const SERVER_URLS = [SERVER_URL, "wss://dottap.ru:7091", "wss://wap-engine.ru:7091"];
/** фото профилей и стандартные аватарки */
export const PHOTO_BASE = "https://dottap.com/mafia/profile_photo";
/** Lottie-анимации украшений: ник и профиль лежат в разных папках */
export const DECORATION_BASE = "https://dottap.com/mafia";
/** сервер Бафии (статистика); игра работает и без него, отправка по умолчанию выключена */
export const BAFIA_SERVER_URL = "ws://localhost:8787";
/** бот, где продаётся премиум Бафии: присылает код для настроек */
export const PREMIUM_BOT_URL = "https://t.me/bafiaonlineopt_bot";
