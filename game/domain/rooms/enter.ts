import type { ServerMessage } from "@common/protocol";
import { sessionDeps } from "../room/deps";
import { RoomSession } from "../room/session";
import type { RoomSettings } from "../room/state";
import type { RoomItem } from "./room";
import { joinProblems, type JoinResult } from "./rooms";
import type { GameContext } from "../../context";

/** параметры комнаты: из ответа сервера на вход, иначе из списка комнат, иначе пустые значения */
export function roomSettings(roomId: string, first: ServerMessage, known?: RoomItem): RoomSettings {
  const info = first.name == "roomEntered" || first.name == "roomCreated" ? first.data.room : undefined;
  return {
    id: roomId,
    modelType: info?.modelType ?? 0,
    title: info?.title ?? known?.title ?? "Комната",
    minPlayers: info?.minPlayers ?? known?.minPlayers ?? 1,
    maxPlayers: info?.maxPlayers ?? known?.maxPlayers ?? 8,
    minLevel: info?.minLevel ?? known?.minLevel ?? 1,
    vip: !!(info?.vipEnabled ?? info?.vip ?? known?.vip),
    roles: info?.roles ?? known?.roles ?? [],
    creator: info?.creator ?? known?.creator
  };
}

/** открыть экран комнаты; `replace` - вместо текущего экрана */
export function openRoom(ctx: GameContext, result: Extract<JoinResult, { status: "ok" }>, { fallbackId = "", replace = false } = {}) {
  const id = result.roomId ?? fallbackId;
  const session = new RoomSession(sessionDeps(ctx), roomSettings(id, result.first, ctx.rooms.get(id)));
  // подписка начинается сразу: пакеты не должны теряться, пока идёт анимация перехода
  session.start(result.first);
  if(replace) ctx.nav.replace("room", { session });
  else ctx.nav.push("room", { session });
}

/** зайти в комнату: спросить пароль и показать причину отказа */
export async function enterRoom(ctx: GameContext, roomId: string, hasPassword: boolean): Promise<void> {
  let password = "";
  if(hasPassword) {
    password = (await ctx.dialogs.prompt({
      title: "ВВЕСТИ ПАРОЛЬ", text: "Эта комната под замком\n\nПожалуйста, введи пароль", ok: "Применить", placeholder: "Пароль"
    }))?.trim() ?? "";
    if(!password) return;
  }

  try {
    const result = await ctx.rooms.join(roomId, password);
    if(result.status == "ok") {
      openRoom(ctx, result, { fallbackId: roomId });
    } else if(result.status == "wrongPassword") {
      await ctx.dialogs.alert(joinProblems.wrongPassword);
      await enterRoom(ctx, roomId, true);
    } else {
      await ctx.dialogs.alert(joinProblems[result.status]);
    }
  } catch {
    await ctx.dialogs.alert("Сервер не ответил. Попробуй ещё раз", { title: "Ошибка" });
  }
}

/** комната соревновательного режима: сервер уже поместил игрока в неё, входить не нужно */
export function openMatchmakingRoom(ctx: GameContext, room: { id: string, roles: number[] }) {
  const session = new RoomSession(sessionDeps(ctx), {
    id: room.id, modelType: 1, title: "Соревновательный режим", minPlayers: 12, maxPlayers: 12, minLevel: 1, vip: false, roles: room.roles
  });
  session.start();
  ctx.nav.push("room", { session });
}
