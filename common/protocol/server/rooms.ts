import { field, optionalField, serverPacket, t } from "../define";
import { K } from "../keys";

/** комната в списке комнат (и «вошли в комнату»): поля, которые присылает сервер */
export const roomInfo = t.object({
  id: optionalField(K.OBJECT_ID, t.string),
  title: optionalField(K.TITLE, t.string),
  /** создатель комнаты (хост) */
  creator: optionalField("rco", t.string),
  /** нужен для действий в комнате (ход, голосование) */
  modelType: optionalField(K.ROOM_MODEL_TYPE, t.number),
  minLevel: optionalField(K.MIN_LEVEL, t.number),
  minPlayers: optionalField(K.MIN_PLAYERS, t.number),
  maxPlayers: optionalField(K.MAX_PLAYERS, t.number),
  /** включённые роли (Role) */
  roles: optionalField(K.SELECTED_ROLES, t.array(t.number)),
  /** хеш пароля: есть - комната под замком */
  password: optionalField(K.PASSWORD, t.any),
  vip: optionalField(K.VIP, t.any),
  /** VIP-комната в ответе на вход (другой ключ) */
  vipEnabled: optionalField(K.VIP_ENABLED, t.any),
  friendsInRoom: optionalField(K.FRIEND_IN_ROOM, t.numeric),
  playersNum: optionalField(K.PLAYERS_NUM, t.numeric),
  /** 0 - регистрация, 3 - игра идёт, остальное - подготовка */
  status: optionalField(K.STATUS, t.numeric),
  /** ваше положение: 0 - играете, 1 - убиты, 2 - вы не в комнате */
  myStatus: optionalField(K.ROOM_STATUS, t.numeric),
  dayTime: optionalField(K.DAYTIME, t.number)
});

export const roomMessages = {
  rooms: serverPacket(K.ROOMS, { rooms: field(K.ROOMS, t.array(roomInfo)) }),
  /** В списке комнат изменилось число игроков */
  roomPlayersChanged: serverPacket(K.ROOM_IN_LOBBY_STATE, {
    state: field(K.ROOM_IN_LOBBY_STATE, t.object({
      roomId: field(K.ROOM_OBJECT_ID, t.string),
      playersInRoom: optionalField(K.PLAYERS_IN_ROOM, t.numeric)
    }))
  }),
  roomStatusChanged: serverPacket(K.GAME_STATUS_IN_ROOMS_LIST, {
    roomId: field(K.ROOM_OBJECT_ID, t.string),
    status: field(K.STATUS, t.numeric)
  }),
  roomAdded: serverPacket(K.ADD, { room: field(K.ROOM, roomInfo) }),
  roomRemoved: serverPacket(K.REMOVE, { roomId: field(K.ROOM_OBJECT_ID, t.string) }),
  playersInRoom: serverPacket(K.PLAYERS_IN_ROOM, {
    players: field(K.PLAYERS, t.array(t.object({
      playerObjectId: optionalField(K.PLAYER_OBJECT_ID, t.string),
      username: optionalField(K.USERNAME, t.string),
      photo: optionalField(K.PHOTO, t.string),
      alive: optionalField(K.ALIVE, t.boolean)
    })))
  }),

  // ответы на вход в комнату
  roomEntered: serverPacket(K.ROOM_ENTER, { room: optionalField(K.ROOM, roomInfo) }),
  roomCreated: serverPacket(K.ROOM_CREATED, { room: optionalField(K.ROOM, roomInfo) }),
  roomPasswordWrong: serverPacket(K.ROOM_PASSWORD_IS_WRONG_ERROR, {}),
  gameAlreadyStarted: serverPacket(K.GAME_STARTED, {}),
  userInAnotherRoom: serverPacket(K.USER_IN_ANOTHER_ROOM, {}),
  userDoubleAccount: serverPacket(K.USER_USING_DOUBLE_ACCOUNT, {}),
  userLevelNotEnough: serverPacket(K.USER_LEVEL_NOT_ENOUGH, {}),
  userKicked: serverPacket(K.USER_KICKED, {}),
  roomFull: serverPacket(K.MAXIMUM_PLAYERS, {}),
  userNotVip: serverPacket(K.USER_IS_NOT_VIP, {})
};
