import { startGame } from "./app";
import type { GameHost } from "@launcher/game";

/** вход боевой сборки (bin/game.js): лаунчер подключает скрипт и вызывает `__bafia.game(host)` */
(((window as unknown as { __bafia?: Record<string, unknown> }).__bafia) ??= {}).game = (host: GameHost) => startGame(host).then(() => {});
