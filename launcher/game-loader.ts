import type { GameLauncher } from "./game";

/** что game.js кладёт в `window.__bafia` */
export interface GameGlobals {
  game?: GameLauncher
  /** версия игры: лаунчер сверяет её со своей */
  version?: string
}

export interface GameLoaderDeps {
  globals: GameGlobals
  /** подключить скрипт по адресу */
  load: (src: string) => Promise<void>
  /** адрес game.js с меткой сборки (`./play/bin/game.js?v=…`) */
  src: string
  /** версия лаунчера: игра должна быть такой же */
  expected: string
  now?: () => number
  /** сообщить о проблеме (журнал) */
  warn?: (message: string) => void
}

/**
 * подключает игру и сверяет её версию с версией лаунчера. Игра - отдельный файл, и браузер мог отдать из кэша старый
 * (лаунчер новый, игра старая: в окне новая версия, а внутри прежняя). Если версии не совпали, game.js загружается заново мимо кэша.
 * Возвращает версию загруженной игры; не совпавшая и после этого версия - не ошибка: игра всё равно запускается, но это попадает в журнал
 */
export async function loadGame({ globals, load, src, expected, now = Date.now, warn = () => {} }: GameLoaderDeps): Promise<string | undefined> {
  if(!globals.game) await load(src);
  if(globals.version != expected) {
    // новый адрес каждый раз, поэтому кэш браузера его не знает
    await load(`${src}${src.includes("?") ? "&" : "?"}t=${now()}`);
    if(globals.version != expected) warn(`Версия игры (${globals.version ?? "неизвестна"}) не совпала с версией лаунчера (${expected})`);
  }
  if(!globals.game) throw new Error("В game.js нет функции запуска игры");
  return globals.version;
}
