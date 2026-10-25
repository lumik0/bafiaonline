import type { Decorations } from "../decorations";
import type { RoomState } from "./state";

/** всё, что нужно нарисовать для одного игрока за столом */
export interface PlayerView {
  playerObjectId: string
  username: string
  index: number
  alive: boolean
  /** известная роль или 0 - «закрытая карта» */
  role: number
  /** ваша пометка роли над игроком */
  preRole?: number
  vote: number
  /** что вы можете сделать с этим игроком сейчас: имя картинки действия */
  action?: string
  isMe: boolean
  decorations?: Decorations
}

/**
 * слепок игроков для отрисовки. Игрок, у которого ничего не изменилось, остаётся тем же объектом:
 * иначе каждый тик таймера пересоздавал бы всех игроков стола и сбрасывал бы анимации
 */
export function createViewCache() {
  let previous = new Map<string, { signature: string, view: PlayerView }>();

  return (state: RoomState): PlayerView[] => {
    const next = new Map<string, { signature: string, view: PlayerView }>();
    const views = state.players.map(player => {
      const view: PlayerView = {
        playerObjectId: player.playerObjectId, username: player.username, index: player.index, alive: player.alive,
        role: player.role ?? 0, preRole: player.preRole, vote: player.vote, action: state.actionFor(player), isMe: player.playerObjectId == state.myPlayerObjectId, decorations: player.decorations
      };
      const signature = JSON.stringify(view);
      const old = previous.get(player.playerObjectId);
      const entry = old?.signature == signature ? old : { signature, view };
      next.set(player.playerObjectId, entry);
      return entry.view;
    });
    previous = next;
    return views;
  };
}
