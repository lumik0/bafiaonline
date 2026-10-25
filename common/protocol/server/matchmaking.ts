import { field, optionalField, serverPacket, t } from "../define";
import { ratingUser } from "./ratings";

export const matchmakingMessages = {
  /** сколько игроков сейчас в соревновательных играх */
  matchmakingOnline: serverPacket("mmuiabk", { online: field("mmuiabk", t.numeric) }),

  /** главный экран: `inRoom` - можно вернуться в начатую игру; `energy` - нужна для поиска */
  matchmakingStatus: serverPacket("mmms", {
    status: field("mmms", t.object({
      inRoom: optionalField("mmuir", t.any),
      ratingUsers: optionalField("rul", t.array(ratingUser)),
      buckets: optionalField("mmblk", t.array(t.object({ players: field("mmbpa", t.numeric) }))),
      energy: optionalField("ue", t.object({
        current: field("ucea", t.numeric),
        maxFree: optionalField("umfea", t.numeric),
        /** через сколько секунд прибавится первая единица */
        firstTimer: optionalField("ueaft", t.numeric),
        nextTimers: optionalField("ueant", t.numeric)
      }))
    }))
  }),

  /** поиск начат (вы в очереди) / остановлен */
  matchmakingInLine: serverPacket("mmis", {}),
  matchmakingStopped: serverPacket("mmss", {}),
  /** вы приняли игру */
  matchmakingAcceptedByMe: serverPacket("mmcuag", {}),
  /** кто-то не принял игру: комната не собралась */
  matchmakingNotAccepted: serverPacket("mmunag", {}),
  /** не хватает энергии (у VIP она бесконечна) */
  matchmakingNoEnergy: serverPacket("mmneue", {}),
  /** не хватает уровня: `level` - какой нужен */
  matchmakingLevelTooLow: serverPacket("nelfmm", { level: field("data", t.any) }),

  /** игра найдена: нужно принять. `secondsLeft` - время на принятие */
  matchmakingAccept: serverPacket("mmag", {
    secondsLeft: optionalField("mmlt", t.numeric),
    accepted: optionalField("mmagua", t.numeric)
  }),
  matchmakingAccepted: serverPacket("mmagu", { accepted: field("mmagua", t.numeric) }),
  matchmakingFound: serverPacket("mmfun", { found: field("mmfun", t.numeric) }),

  /** выбор ролей перед игрой */
  matchmakingRoles: serverPacket("mmsr", {
    secondsLeft: optionalField("mmlt", t.numeric),
    selected: optionalField("mmcusr", t.array(t.numeric))
  }),
  /** роль → сколько игроков её выбрали */
  matchmakingRoleCounts: serverPacket("mmrc", { counts: field("mmrc", t.record(t.numeric)) }),

  /** комната готова: `o` - id комнаты, `sr` - роли */
  matchmakingRoom: serverPacket("mmrr", {
    room: field("rr", t.object({
      id: field("o", t.string),
      roles: optionalField("sr", t.array(t.numeric))
    }))
  }),

  /** поиск временно заблокирован */
  matchmakingBanned: serverPacket("mmib", {
    reason: field("mmbt", t.numeric),
    seconds: field("mmbut", t.numeric)
  })
};
