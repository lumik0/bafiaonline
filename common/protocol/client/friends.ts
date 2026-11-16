import { clientPacket, field, t } from "../define";
import { K } from "../keys";

export const friendsPackets = {
  searchUser: clientPacket(K.SEARCH_USER, {
    text: field(K.SEARCH_TEXT, t.string)
  }),

  addFriend: clientPacket(K.ADD_FRIEND, {
    userObjectId: field(K.FRIEND_USER_OBJECT_ID, t.string)
  }),

  removeFriend: clientPacket(K.REMOVE_FRIEND, {
    userObjectId: field(K.FRIEND_USER_OBJECT_ID, t.string)
  }),

  /** список друзей для приглашения в комнату, где ты сейчас (в официальном клиенте без `uo`/`t`) */
  getInviteList: clientPacket(K.GET_FRIENDS_IN_INVITE_LIST, {}),

  /** пригласить друга в свою комнату */
  inviteFriend: clientPacket(K.SEND_FRIEND_INVITE_TO_ROOM, {
    playerObjectId: field(K.PLAYER_OBJECT_ID, t.string)
  })
};
