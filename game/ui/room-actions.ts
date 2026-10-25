import { createSignal } from "@common/ui";
import { enterRoom } from "../domain/rooms/enter";
import { WaitDialog } from "./dialogs/WaitDialog.tsrx";
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
