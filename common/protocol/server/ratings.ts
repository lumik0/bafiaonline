import { field, optionalField, serverPacket, t } from "../define";

/** игрок в рейтинге; `value` - очки (опыт, победы, игры, серебро или кубки - смотря какой рейтинг) */
export const ratingUser = t.object({
  playerObjectId: optionalField("puo", t.string),
  username: optionalField("u", t.string),
  photo: optionalField("ph", t.string),
  vip: optionalField("v", t.any),
  decorations: optionalField("dcrs", t.record(t.record(t.any))),
  sex: optionalField("s", t.numeric),
  isOnline: optionalField("on", t.any),
  value: optionalField("rv", t.numeric)
});

export const ratingMessages = {
  /** рейтинг: тип (`rt`: experience, wins, games, silverCoins, matchMakingScore) и игроки по порядку мест */
  rating: serverPacket("rtg", {
    type: optionalField("rt", t.string),
    users: field("rul", t.array(ratingUser))
  })
};
