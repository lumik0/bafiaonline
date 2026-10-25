import type { GameContext } from "../../context";
import type { SessionDeps } from "./session";

/** всё, что нужно сессии комнаты: сеть, история, настройки, кто вы */
export const sessionDeps = (ctx: GameContext): SessionDeps => ({
  client: ctx.client, history: ctx.history, settings: ctx.settings, myPlayerObjectId: ctx.user.playerObjectId
});
