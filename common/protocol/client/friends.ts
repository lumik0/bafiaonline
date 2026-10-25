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
  })
};
