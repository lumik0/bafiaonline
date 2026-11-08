import { createSignal } from "@common/ui";
import { enterRoom } from "../domain/rooms/enter";
import { WaitDialog } from "./dialogs/WaitDialog.tsrx";
import type { RoomItem } from "../domain/rooms/room";
import type { GameContext } from "../context";

/** ждать свободного места в комнате (окно с «Отмена») и зайти, когда появится */
export async function waitAndJoin(ctx: GameContext, roomId: string): Promise<void> {
  const room = ctx.rooms.get(roomId);
  if(!room) throw new Error("Этой комнаты нет в списке");

  const [players, setPlayers] = createSignal(room.playersNum);
  const waiting = ctx.rooms.waitForSlot(room, setPlayers);
  void ctx.dialogs.manager.open({ title: "ЖДЁМ", dismissable: true, render: () => WaitDialog({ text: () => "Игроков в комнате: " + players(), cancel: () => waiting.cancel() }) });
  const result = await waiting.done;
  ctx.dialogs.manager.closeAll();
  if(result == "slot") await enterRoom(ctx, room.id, room.hasPassword);
  else if(result == "started") await ctx.dialogs.alert("Игра началась");
}

/**
 * ждать, пока появится комната, подходящая под `match`, и сразу зайти (окно с «Отмена»); `existing` - подходят ли и уже созданные комнаты.
 * Список комнат должен быть открыт: комнаты приходят его событиями
 */
export async function waitForRoom(ctx: GameContext, text: string, match: (room: RoomItem) => boolean, existing?: (room: RoomItem) => boolean, password = ""): Promise<void> {
  const waiting = ctx.rooms.waitForRoom(match, existing);
  void ctx.dialogs.manager.open({ title: "ЖДЁМ", dismissable: true, render: () => WaitDialog({ text: () => text, cancel: () => waiting.cancel() }) });
  const result = await waiting.done;
  ctx.dialogs.manager.closeAll();
  if(result != "cancelled") await enterRoom(ctx, result.id, result.hasPassword, password);
}

/**
 * ждать новую комнату хоста после конца игры: выходим из этой комнаты, открываем список и ждём комнату того же создателя
 * (а если создатель неизвестен - с тем же названием); уже созданная, ждущая игроков комната тоже подойдёт, кроме этой самой
 */
export async function waitForHostRoom(ctx: GameContext, oldRoom: { id: string, title: string, creator?: string }): Promise<void> {
  const same = (room: RoomItem) => room.id != oldRoom.id && ((!!oldRoom.creator && room.creator == oldRoom.creator) || room.title.trim().toLowerCase() == oldRoom.title.trim().toLowerCase());
  ctx.nav.replace("rooms");
  await waitForRoom(ctx, "Ждём, пока хост создаст новую комнату", same, room => same(room) && room.status == 0);
}
