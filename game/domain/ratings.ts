import type { ServerClient } from "@common/net";
import type { ServerData } from "@common/protocol";
import { normalizeDecorations, type Decorations } from "./decorations";

type WireUser = ServerData<"rating">["users"][number];

export interface RatingUser {
  playerObjectId: string
  username: string
  photo?: string
  decorations?: Decorations
  isOnline: boolean
  /** очки рейтинга */
  value: number
}

/** рейтинги, как у официального приложения: что считаем */
export const ratingTypes = [
  { id: "matchMakingScore", label: "Кубки" },
  { id: "experience", label: "Опыт" },
  { id: "wins", label: "Победы" },
  { id: "games", label: "Игры" },
  { id: "silverCoins", label: "Серебро" }
] as const;

export type RatingType = typeof ratingTypes[number]["id"];

export const ratingModes = [
  { id: "today", label: "за сегодня" },
  { id: "yesterday", label: "за вчера" },
  { id: "all_time", label: "за всё время" }
] as const;

export type RatingMode = typeof ratingModes[number]["id"];

export const ratingsInfo = "В дневном рейтинге не участвуют игры в комнатах с паролем.\n\nВ рейтинге за всё время не участвуют игроки, достигшие максимального уровня.";

export function toRatingUser(wire: WireUser): RatingUser | undefined {
  if(!wire.playerObjectId) return undefined;
  return {
    playerObjectId: wire.playerObjectId,
    username: wire.username ?? "",
    photo: wire.photo,
    decorations: normalizeDecorations(wire.decorations),
    isOnline: wire.isOnline === true || wire.isOnline === 1,
    value: wire.value ?? 0
  };
}

export const toRatingUsers = (wire: readonly WireUser[] | undefined): RatingUser[] =>
  (wire ?? []).map(toRatingUser).filter((user): user is RatingUser => !!user);

/** рейтинг по типу и периоду: игроки приходят уже по порядку мест */
export class Ratings {
  constructor(private client: ServerClient) {}

  async load(type: RatingType, mode: RatingMode): Promise<RatingUser[]> {
    const answer = await this.client.request("getRating", { type, mode }, "rating");
    return toRatingUsers(answer.data.users);
  }
}
