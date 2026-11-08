import type { ServerMessage } from "@common/protocol";
import { sessionDeps } from "../room/deps";
import { RoomSession } from "../room/session";
import type { RoomSettings } from "../room/state";
import type { RoomItem } from "./room";
import { md5salt } from "@common/utils/md5";
import { forgetRoomPassword, rememberRoomPassword, savedRoomPassword } from "./passwords";
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

/**
 * зайти в комнату: спросить пароль и показать причину отказа.
 * Если в эту комнату уже входили с паролем, он сохранён и второй раз не спрашивается; перестал подходить - забываем и спрашиваем снова.
 * `knownPassword` - пароль, заданный заранее: пробуем его, а не спрашиваем
 */
export async function enterRoom(ctx: GameContext, roomId: string, hasPassword: boolean, knownPassword = "", replace = false): Promise<void> {
  let hash = "";
  let saved = false;
  if(hasPassword) {
    // пароль, который игрок указал заранее (ожидание комнаты), важнее сохранённого и вводить его второй раз не нужно
    hash = knownPassword ? md5salt(knownPassword) : savedRoomPassword(ctx.settings, roomId) ?? "";
    saved = !!hash;
    if(!hash) {
      const password = (await ctx.dialogs.prompt({
        title: "ВВЕСТИ ПАРОЛЬ", text: "Эта комната под замком\n\nПожалуйста, введи пароль", ok: "Применить", placeholder: "Пароль"
      }))?.trim() ?? "";
      if(!password) return;
      hash = md5salt(password);
    }
  }

  try {
    const result = await ctx.rooms.joinHashed(roomId, hash);
    if(result.status == "ok") {
      if(hash) rememberRoomPassword(ctx.settings, roomId, hash);
      openRoom(ctx, result, { fallbackId: roomId, replace });
    } else if(result.status == "wrongPassword") {
      forgetRoomPassword(ctx.settings, roomId);
      // сохранённый пароль устарел (хост сменил его): молча спрашиваем заново, а не ругаемся на пароль, который игрок не вводил
      if(!saved) await ctx.dialogs.alert(joinProblems.wrongPassword);
      await enterRoom(ctx, roomId, true, "", replace);
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
  // экран поиска заменяется комнатой: «назад» из игры ведёт в меню, а не в поиск, который сразу вернул бы в эту же игру
  if(ctx.nav.top?.name == "competitive") ctx.nav.replace("room", { session });
  else ctx.nav.push("room", { session });
}
