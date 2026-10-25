import { clientPacket, field, t } from "../define";
import { K } from "../keys";

export const lobbyPackets = {
  addClientToDashboard: clientPacket(K.ADD_CLIENT_TO_DASHBOARD, {}, { auth: true }),
  addClientToChat: clientPacket(K.ADD_CLIENT_TO_CHAT, {}, { auth: true }),
  addClientToRoomsList: clientPacket(K.ADD_CLIENT_TO_ROOMS_LIST, {}, { auth: true }),
  addClientToFriendsList: clientPacket(K.ADD_CLIENT_TO_FRIENDSHIP_LIST, {}, { auth: true }),
  getSentFriendRequests: clientPacket(K.GET_SENT_FRIEND_REQUESTS_LIST, {}, { auth: true }),

  getPlayersInRoom: clientPacket(K.GET_PLAYERS, {
    roomId: field(K.ROOM_OBJECT_ID, t.string)
  })
};
