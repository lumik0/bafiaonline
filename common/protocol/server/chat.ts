import { field, optionalField, serverPacket, t } from "../define";
import { K } from "../keys";

const userFields = () => ({
  objectId: optionalField(K.OBJECT_ID, t.string),
  playerObjectId: optionalField(K.PLAYER_OBJECT_ID, t.string),
  username: optionalField(K.USERNAME, t.string),
  photo: optionalField(K.PHOTO, t.string),
  /** значок VIP: строка (эмодзи) или что-то ещё; показываем как есть */
  vip: optionalField(K.VIP, t.any),
  isOnline: optionalField(K.IS_ONLINE, t.boolean),
  /** украшения игрока: тип → { параметр → значение } (номера и смысл - в game/domain/decorations.ts) */
  decorations: optionalField("dcrs", t.record(t.record(t.any)))
});

/** игрок в чате или списке игроков. В списках комнат данные игрока лежат внутри `playerUser` */
export const chatUser = t.object({
  ...userFields(),
  playerUser: optionalField(K.PLAYER_USER, t.object(userFields()))
});

/** сообщение общего чата и чата комнаты. Системные (вход, выход, итоги голосования) - те же с type */
export const chatMessage = t.object({
  text: optionalField(K.TEXT, t.string),
  /** MessageType из enums.ts */
  type: optionalField(K.MESSAGE_TYPE, t.number),
  sticker: optionalField(K.MESSAGE_STICKER, t.boolean),
  style: optionalField(K.MESSAGE_STYLE, t.number),
  user: optionalField(K.USER, chatUser),
  id: optionalField(K.OBJECT_ID, t.string),
  /** участники события в комнате (кого выгоняют): объект с ключами 0, 1… или массив */
  targets: optionalField(K.USERNAME, t.any)
});

const privateMessage = t.object({
  id: optionalField(K.OBJECT_ID, t.string),
  /** playerObjectId отправителя */
  playerObjectId: optionalField(K.PLAYER_OBJECT_ID, t.string),
  text: optionalField(K.TEXT, t.string),
  created: optionalField(K.CREATED, t.number),
  /** 0 / false - собеседник ещё не прочитал (сервер шлёт и числом, и true/false) */
  accepted: optionalField(K.ACCEPTED, t.flag)
});

export const chatMessages = {
  chatMessages: serverPacket(K.MESSAGES, { messages: field(K.MESSAGES, t.array(chatMessage)) }),
  chatMessage: serverPacket(K.MESSAGE, { message: field(K.MESSAGE, chatMessage) }),
  chatUsers: serverPacket(K.USERS, { users: field(K.USERS, t.array(chatUser)) }),

  privateChatMessages: serverPacket("pcmsr", { messages: field(K.MESSAGES, t.array(privateMessage)) }),
  privateChatMessage: serverPacket("pcmr", { message: field(K.MESSAGE, privateMessage) }),
  /** собеседник начал / закончил печатать */
  privateTypingStarted: serverPacket("pruit", {}),
  privateTypingStopped: serverPacket("pruint", {})
};
