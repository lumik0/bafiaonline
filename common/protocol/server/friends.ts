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
  /** 0 - входящая заявка, ждёт вашего ответа */
  accepted: optionalField(K.ACCEPTED, t.numeric),
  updated: optionalField(K.UPDATED, t.number),
  /** комната, где друг играет; схема появится с экраном комнат */
  room: optionalField(K.ROOM, t.any)
});

export const friendsMessages = {
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
