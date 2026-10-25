import { loadScript, scriptAssetsSource } from "@common/assets/script-source";
import { startLauncher } from "./index";
import type { GameHost } from "./game";

// страница play.html лежит в корне сайта, скрипты рядом в play/bin
const BASE = "./play/bin";

/** вход сборки; игра - отдельный скрипт bin/game.js */
async function launchGame(host: GameHost) {
  const globals = (window as unknown as { __bafia?: { game?: (host: GameHost) => void | Promise<void> } });
  if(!globals.__bafia?.game) await loadScript(`${BASE}/game.js`);
  if(!globals.__bafia?.game) throw new Error("В game.js нет функции запуска игры");
  await globals.__bafia.game(host);
}

document.body.style.margin = "0";
void startLauncher(document.getElementById("root")!, launchGame, scriptAssetsSource(BASE));
