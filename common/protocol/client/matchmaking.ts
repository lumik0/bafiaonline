import { clientPacket, field, t } from "../define";
import { K } from "../keys";

const playersAmount = { playersAmount: field(K.MATCH_MAKING_BASE_PLAYERS_AMOUNT, t.number) };

/** рейтинг: тип (`experience`, `wins`…) и период (`today`, `yesterday`, `all_time`) */
export const ratingPackets = {
  getRating: clientPacket("gr", {
    type: field("rt", t.string),
    mode: field("rmd", t.string)
  })
};

export const matchmakingPackets = {
  getMatchmakingStatus: clientPacket(K.MATCH_MAKING_GET_STATUS, {}, { auth: true }),
  getMatchmakingOnline: clientPacket(K.GET_MATCH_MAKING_USERS_IN_QUEUE_INTERVAL, playersAmount),
  startMatchmakingSearch: clientPacket(K.MATCH_MAKING_ADD_USER, playersAmount),
  stopMatchmakingSearch: clientPacket(K.MATCH_MAKING_REMOVE_USER, {}),
  acceptMatchmakingGame: clientPacket(K.MATCH_MAKING_ADD_GAME, {}),
  /** wire: "mmrtr" */
  returnToMatchmakingRoom: clientPacket("mmrtr", {}),
  /** wire: "mmsr" */
  selectMatchmakingRole: clientPacket("mmsr", { role: field(K.ROLE, t.number) }),
  /** wire: "mmusr" */
  unselectMatchmakingRole: clientPacket(K.MATCH_MAKING_USER_SELECT_ROLE, { role: field(K.ROLE, t.number) })
};
