import { startGame } from "./app";
import { versionNumber } from "@common/version";
import type { GameHost } from "@launcher/game";

/** вход боевой сборки (bin/game.js): лаунчер подключает скрипт и вызывает `__bafia.game(host)`; `version` нужна лаунчеру, чтобы сверить, что игра той же версии, что и он сам */
const globals = (((window as unknown as { __bafia?: Record<string, unknown> }).__bafia) ??= {});
globals.game = (host: GameHost) => startGame(host).then(() => {});
globals.version = versionNumber;
