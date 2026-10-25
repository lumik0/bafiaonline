import { openRoom } from "./enter";
import { joinProblems } from "./rooms";
import type { RoomSession } from "../room/session";
import type { GameContext } from "../../context";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * рехост: выйти из этой комнаты и создать такую же заново (название, число игроков, уровень, роли, VIP)
 * пароля сервер не присылает, новая комната без пароля; старая может ещё числиться за игроком:
 * несколько раз пробуем с паузой
 */
export async function rehostRoom(ctx: GameContext, session: RoomSession): Promise<void> {
  if(session.replay) throw new Error("Это просмотр сохранённой игры");
  const settings = session.state.settings;
  session.leave();

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
