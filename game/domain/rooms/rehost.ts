import { openRoom } from "./enter";
import { joinProblems } from "./rooms";
import type { RoomItem } from "./room";
import type { RoomSession } from "../room/session";
import type { GameContext } from "../../context";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type Copy = { title: string, minPlayers: number, maxPlayers: number, minLevel: number, roles: number[], vip: boolean };

/** сейчас идёт игра, и ты в ней играешь: выйти и создать комнату заново нельзя */
export const rehostBlocked = (session: RoomSession) => session.state.phase == "game" && !!session.state.me && !session.replay;

/** создать комнату с такими же настройками: пароля сервер не присылает; старая может ещё числиться за игроком, поэтому несколько попыток с паузой */
async function createCopy(ctx: GameContext, settings: Copy): Promise<void> {
  for(let attempt = 0; attempt < 4; attempt++) {
    const result = await ctx.rooms.create({
      title: settings.title, minPlayers: settings.minPlayers, maxPlayers: settings.maxPlayers, minLevel: settings.minLevel,
      selectedRoles: settings.roles, password: "", vip: settings.vip
    });
    if(result.status == "ok") return openRoom(ctx, result, { replace: true });
    if(result.status != "anotherRoom") {
      await ctx.dialogs.alert(joinProblems[result.status]);
      return;
    }
    await wait(600);
  }
  await ctx.dialogs.alert("Не удалось создать комнату заново: сервер ещё считает тебя в прежней. Попробуй через несколько секунд.");
}

/**
 * рехост из комнаты: выйти из этой комнаты и создать такую же заново (название, число игроков, уровень, роли, VIP);
 * пока идёт игра и ты в ней, нельзя
 */
export async function rehostRoom(ctx: GameContext, session: RoomSession): Promise<void> {
  if(session.replay) throw new Error("Это просмотр сохранённой игры");
  if(rehostBlocked(session)) throw new Error("Игра идёт: рехост сейчас недоступен");
  const settings = session.state.settings;
  ctx.bafia.track("feature:rehost");
  session.leave();
  await createCopy(ctx, { ...settings, roles: settings.roles });
}

/** рехост из списка комнат (всегда доступен): создать комнату с такими же настройками, как у этой */
export function rehostListed(ctx: GameContext, room: RoomItem): Promise<void> {
  ctx.bafia.track("feature:rehost");
  return createCopy(ctx, room);
}
