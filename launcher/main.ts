import { scriptAssetsSource, loadScript } from "@common/assets/script-source";
import { log } from "@common/logger";
import { versionNumber } from "@common/version";
import { isAppMode } from "@common/utils/native";
import { startApp } from "./app";
import { startLauncher } from "./index";
import { loadGame, type GameGlobals } from "./game-loader";
import type { GameHost } from "./game";

// страница play.html лежит в корне сайта, скрипты рядом в play/bin
const BASE = "./play/bin";

// метка сборки из адреса этого скрипта (`index.js?v=…`): ею помечаются и остальные файлы, чтобы после выкладки браузер не взял старые из кэша
const build = new URL((document.currentScript as HTMLScriptElement | null)?.src ?? location.href).searchParams.get("v");
const SUFFIX = build ? `?v=${build}` : "";

/** вход сборки; игра - отдельный скрипт bin/game.js */
async function launchGame(host: GameHost) {
  const globals = ((window as unknown as { __bafia?: GameGlobals }).__bafia ??= {});
  await loadGame({ globals, load: loadScript, src: `${BASE}/game.js${SUFFIX}`, expected: versionNumber, warn: message => log("warn", message) });
  await globals.game!(host);
}

document.body.style.margin = "0";
// в приложении рабочего стола с окнами нет: сразу игра
void (isAppMode() ? startApp : startLauncher)(document.getElementById("root")!, launchGame, scriptAssetsSource(BASE, SUFFIX));
