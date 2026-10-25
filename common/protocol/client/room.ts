import { clientPacket, field, t } from "../define";
import { K } from "../keys";

export const roomPackets = {
  createRoom: clientPacket(K.ROOM_CREATE, {
    room: field(K.ROOM, t.object({
      title: field(K.TITLE, t.string),
      daytime: field(K.DAYTIME, t.number),
      minPlayers: field(K.MIN_PLAYERS, t.number),
      maxPlayers: field(K.MAX_PLAYERS, t.number),
      minLevel: field(K.MIN_LEVEL, t.number),
      selectedRoles: field(K.SELECTED_ROLES, t.array(t.number)),
      /** md5salt от пароля или "" */
      password: field(K.PASSWORD, t.string),
      vip: field(K.VIP_ENABLED, t.boolean)
    }))
  }, { auth: true }),

  /** password - md5salt или "" */
  enterRoom: clientPacket(K.ROOM_ENTER, {
    password: field(K.ROOM_PASS, t.string),
    roomId: field(K.ROOM_OBJECT_ID, t.string)
  }),

  createPlayer: clientPacket(K.CREATE_PLAYER, {
    roomId: field(K.ROOM_OBJECT_ID, t.string),
    modelType: field(K.ROOM_MODEL_TYPE, t.number)
  }, { auth: true }),

  leaveRoom: clientPacket(K.REMOVE_PLAYER, {
    roomId: field(K.ROOM_OBJECT_ID, t.string)
  }),

  giveUp: clientPacket(K.GIVE_UP, {
    roomId: field(K.ROOM_OBJECT_ID, t.string)
  }),

  roleAction: clientPacket(K.ROLE_ACTION, {
    playerObjectId: field(K.PLAYER_OBJECT_ID, t.string),
    roomId: field(K.ROOM_OBJECT_ID, t.string),
    modelType: field(K.ROOM_MODEL_TYPE, t.number)
  }),

  kickUser: clientPacket(K.KICK_USER, {
    roomId: field(K.ROOM_OBJECT_ID, t.string),
    playerObjectId: field(K.PLAYER_OBJECT_ID, t.string)
  }),

  voteKick: clientPacket(K.KICK_USER_VOTE, {
    roomId: field(K.ROOM_OBJECT_ID, t.string),
    vote: field(K.VOTE, t.boolean)
  })
};
