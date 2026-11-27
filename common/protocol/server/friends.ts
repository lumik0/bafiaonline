import { field, optionalField, serverPacket, t } from "../define";
import { K } from "../keys";
import { chatUser } from "./chat";

/** запись списка друзей или входящих/исходящих заявок */
const friendEntry = t.object({
  /** id дружбы: нужен для личного чата */
  id: optionalField(K.OBJECT_ID, t.string),
  friend: optionalField(K.FRIEND, chatUser),
  user: optionalField(K.USER, chatUser),
  newMessages: optionalField(K.NEW_MESSAGES, t.numeric),
  /** 0 - заявка ещё не принята; входящая приходит с `user`, исходящая с `friend` */
  accepted: optionalField(K.ACCEPTED, t.numeric),
  updated: optionalField(K.UPDATED, t.number),
  /** комната, где друг играет; схема появится с экраном комнат */
  room: optionalField(K.ROOM, t.any)
});

/** друг в списке приглашений */
const inviteEntry = t.object({
  playerObjectId: optionalField(K.PLAYER_OBJECT_ID, t.string),
  username: optionalField(K.USERNAME, t.string),
  photo: optionalField(K.PHOTO, t.string),
  /** 1 - друг сейчас в сети (число или true/false) */
  isOnline: optionalField(K.IS_ONLINE, t.flag),
  /** 1 - уже приглашён */
  invited: optionalField(K.IS_INVITED, t.flag),
  decorations: optionalField("dcrs", t.record(t.record(t.any)))
});

export const friendsMessages = {
  inviteList: serverPacket(K.FRIENDS_IN_INVITE_LIST, { friends: field(K.FRIENDS_IN_INVITE_LIST, t.array(inviteEntry)) }),
  /** приглашение отправлено */
  friendInvited: serverPacket(K.FRIEND_IS_INVITED, { playerObjectId: optionalField(K.PLAYER_OBJECT_ID, t.string) }),
  /** приглашать друзей в комнату может только VIP */
  inviteNeedsVip: serverPacket(K.USER_IS_NOT_VIP_TO_INVITE_FRIENDS_IN_ROOM, {}),

  friendshipList: serverPacket(K.FRIENDSHIP_LIST, {
    list: field(K.FRIENDSHIP_LIST, t.object({ entries: field(K.FRIENDSHIP_LIST, t.array(friendEntry)) }))
  }),
  searchResults: serverPacket(K.SEARCH_USER, { users: field(K.USERS, t.array(chatUser)) }),

  friendAdded: serverPacket(K.ADD_FRIEND, {}),
  friendRemoved: serverPacket(K.REMOVE_FRIEND, {}),
  friendshipListFull: serverPacket(K.YOUR_FRIENDSHIP_LIST_FULL, {
    limit: field(K.FRIENDSHIP_LIST_LIMIT, t.number)
  })
};
