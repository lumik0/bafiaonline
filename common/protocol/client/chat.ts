import { clientPacket, field, t } from "../define";
import { K } from "../keys";

/** style: 0 обычное, 3 в личке; sticker - сообщение-стикер */
const message = t.object({
  text: field(K.TEXT, t.string),
  style: field(K.MESSAGE_STYLE, t.number),
  sticker: field(K.MESSAGE_STICKER, t.boolean)
});

export const chatPackets = {
  sendChatMessage: clientPacket(K.CHAT_MESSAGE_CREATE, {
    message: field(K.MESSAGE, message)
  }),

  sendRoomMessage: clientPacket(K.ROOM_MESSAGE_CREATE, {
    message: field(K.MESSAGE, message),
    roomId: field(K.ROOM_OBJECT_ID, t.string),
    modelType: field(K.ROOM_MODEL_TYPE, t.number)
  }),

  openPrivateChat: clientPacket(K.ADD_CLIENT_TO_PRIVATE_CHAT, {
    friendshipId: field(K.FRIENDSHIP, t.string)
  }, { auth: true }),

  acceptPrivateMessages: clientPacket(K.ACCEPT_MESSAGES, {
    friendshipId: field(K.FRIENDSHIP, t.string)
  }),

  sendPrivateMessage: clientPacket(K.PRIVATE_CHAT_MESSAGE_CREATE, {
    friendshipId: field(K.FRIENDSHIP, t.string),
    message: field(K.MESSAGE, message)
  })
};
