import type { GameSettings } from "@common/storage";
import { Role } from "./enums";
import type { GamePlayer } from "./room/state";

/** подсказки: каждая показывается, пока игрок её не выполнит, потом больше никогда */
export type TipId = "markRole";

/** сколько раз показываем подсказку, если её игнорируют */
export const MAX_TIP_SHOWS = 3;

export type TipSettings = { data: Pick<GameSettings, "tips"> };

/** в сообщении слово «шер» или «шериф» целиком: «я шер, чек Вася маф» (без «шерсть», «шершавый») */
const SHERIFF = /(^|[^а-яёa-z])(шер|шериф(?:а|у|ом|е|ы)?)(?![а-яёa-z])/i;
export const claimsSheriff = (text: string) => SHERIFF.test(text);

export function tipActive(settings: TipSettings, id: TipId) {
  const { enabled, done, shown } = settings.data.tips;
  return enabled && !done.includes(id) && (shown[id] ?? 0) < MAX_TIP_SHOWS;
}

export function markTipShown(settings: { update(change: (data: GameSettings) => void): void }, id: TipId) {
  settings.update(data => { data.tips.shown[id] = (data.tips.shown[id] ?? 0) + 1; });
}

export function completeTip(settings: { update(change: (data: GameSettings) => void): void }, id: TipId) {
  settings.update(data => { if(!data.tips.done.includes(id)) data.tips.done.push(id); });
}

export function resetTips(settings: { update(change: (data: GameSettings) => void): void }) {
  settings.update(data => { data.tips.done = []; data.tips.shown = {}; });
}

/**
 * кому подсказать «отметь роль»: автор сообщения про шерифа, если он жив, не ты, роль неизвестна и ещё не отмечена.
 * Возвращает `playerObjectId` или `undefined`
 */
export function sheriffClaimTarget(text: string, author: GamePlayer | undefined, myPlayerObjectId: string | undefined): string | undefined {
  if(!author || !claimsSheriff(text)) return undefined;
  if(author.playerObjectId == myPlayerObjectId || author.alive === false) return undefined;
  if((author.role ?? 0) != 0 || author.preRole == Role.Sheriff) return undefined;
  return author.playerObjectId;
}
