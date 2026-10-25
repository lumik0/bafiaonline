import { field, serverPacket, t } from "../define";
import { K } from "../keys";
import { authMessages } from "./auth";
import { backpackMessages } from "./backpack";
import { chatMessages } from "./chat";
import { friendsMessages } from "./friends";
import { gameMessages } from "./game";
import { marketMessages } from "./market";
import { matchmakingMessages } from "./matchmaking";
import { profileMessages } from "./profile";
import { ratingMessages } from "./ratings";
import { roomMessages } from "./rooms";

/** входящие пакеты; незнакомые приходят как `unknown` */
export const serverPackets = {
  ...authMessages,
  ...profileMessages,
  ...friendsMessages,
  ...chatMessages,
  ...roomMessages,
  ...gameMessages,
  ...backpackMessages,
  ...marketMessages,
  ...matchmakingMessages,
  ...ratingMessages,

  /** пакет без ty: { t: секунды } */
  timer: serverPacket(null, {
    seconds: field(K.TIMER, t.number)
  })
};
