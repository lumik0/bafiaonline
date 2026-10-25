import { field, optionalField, serverPacket, t } from "../define";
import { K } from "../keys";
import { roomInfo } from "./rooms";

const coins = t.object({
  gold: optionalField(K.GOLD_COINS, t.number),
  silver: optionalField(K.SILVER_COINS, t.number)
});

const profileUser = t.object({
  objectId: optionalField(K.OBJECT_ID, t.string),
  playerObjectId: optionalField(K.PLAYER_OBJECT_ID, t.string),
  username: optionalField(K.USERNAME, t.string),
  photo: optionalField(K.PHOTO, t.string),
  isOnline: optionalField(K.IS_ONLINE, t.boolean),
  level: optionalField(K.LEVEL, t.number),
  experience: optionalField(K.EXPERIENCE, t.number),
  nextLevelExperience: optionalField(K.NEXT_LEVEL_EXPERIENCE, t.number),
  previousLevelExperience: optionalField(K.PREVIOUS_LEVEL_EXPERIENCE, t.number),
  matchMakingScore: optionalField(K.MATCH_MAKING_SCORE, t.number),
  /** роль → сколько игр сыграно */
  roleStatistics: optionalField(K.PLAYER_ROLE_STATISTICS, t.record(t.number)),
  playedGames: optionalField(K.PLAYED_GAMES, t.number),
  winsAsMafia: optionalField(K.WINS_AS_MAFIA, t.number),
  winsAsPeaceful: optionalField(K.WINS_AS_PEACEFUL, t.number),
  /** 0 - мужской, 1 - женский (тот же ключ "s", что и status) */
  sex: optionalField(K.SEX, t.number),
  serverLanguage: optionalField(K.SERVER_LANGUAGE, t.string),
  vip: optionalField(K.VIP, t.any),
  updated: optionalField(K.UPDATED, t.number)
});

const dashboardUser = t.object({
  playerObjectId: optionalField(K.PLAYER_OBJECT_ID, t.string),
  username: optionalField(K.USERNAME, t.string),
  photo: optionalField(K.PHOTO, t.string),
  status: optionalField(K.STATUS, t.number),
  level: optionalField(K.LEVEL, t.number),
  experience: optionalField(K.EXPERIENCE, t.number),
  nextLevelExperience: optionalField(K.NEXT_LEVEL_EXPERIENCE, t.number),
  previousLevelExperience: optionalField(K.PREVIOUS_LEVEL_EXPERIENCE, t.number),
  userRank: optionalField(K.USER_RANK, t.number),
  playedGames: optionalField(K.PLAYED_GAMES, t.number),
  matchMakingScore: optionalField(K.MATCH_MAKING_SCORE, t.number),
  /** роль → сколько игр сыграно */
  roleStatistics: optionalField(K.PLAYER_ROLE_STATISTICS, t.record(t.number)),
  serverLanguage: optionalField(K.SERVER_LANGUAGE, t.string),
  updated: optionalField(K.UPDATED, t.number),
  vip: optionalField(K.VIP, t.any),
  winsAsKiller: optionalField(K.WINS_AS_KILLER, t.number),
  winsAsMafia: optionalField(K.WINS_AS_MAFIA, t.number),
  winsAsPeaceful: optionalField(K.WINS_AS_PEACEFUL, t.number)
});

export const profileMessages = {
  dashboard: serverPacket(K.DASHBOARD, {
    dashboard: field(K.DASHBOARD, t.object({
      user: field(K.DASHBOARD_USER, dashboardUser),
      coins: optionalField(K.USER_ACCOUNT_COINS, coins),
      /** заявок в друзья и новых личных сообщений */
      friendshipRequests: optionalField(K.FRIENDSHIP_REQUESTS, t.numeric),
  /** украшения игрока: тип → { параметр → значение } (номера и смысл - в game/domain/decorations.ts) */
  decorations: optionalField("dcrs", t.record(t.record(t.any))),

      newMessages: optionalField(K.NEW_MESSAGES, t.numeric)
    }))
  }),

  /** профиль игрока; friendshipFlag: 1 - вы отправили заявку, 2 - вам, 3 - друзья */
  userProfile: serverPacket(K.USER_PROFILE, {
    profile: field(K.USER_PROFILE, t.object({
      user: field(K.PROFILE_USER_DATA, profileUser),
      coins: optionalField(K.USER_ACCOUNT_COINS, coins),
      friendship: optionalField(K.FRIENDSHIP, t.any),
  /** украшения игрока: тип → { параметр → значение } (номера и смысл - в game/domain/decorations.ts) */
  decorations: optionalField("dcrs", t.record(t.record(t.any))),

      friendshipFlag: optionalField(K.FRIENDSHIP_FLAG, t.numeric),
      /** комната, в которой игрок играет сейчас: те же поля, что в списке комнат (названия может не быть) */
      room: optionalField(K.ROOM, roomInfo)
    }))
  }),

  usernameSet: serverPacket(K.USERNAME_SET, { username: optionalField(K.USERNAME, t.string) }),
  usernameWrongSymbols: serverPacket(K.USERNAME_HAS_WRONG_SYMBOLS, {}),
  usernameExists: serverPacket(K.USERNAME_IS_EXISTS, {}),
  usernameOutOfBounds: serverPacket(K.USERNAME_IS_OUT_OF_BOUNDS, {}),
  usernameEmpty: serverPacket(K.USERNAME_IS_EMPTY, {}),

  photoRemoved: serverPacket(K.REMOVE_PHOTO, {}),
  defaultPhotoSet: serverPacket("ussdph", {}),

  defaultPhotos: serverPacket(K.USER_DEFAULT_PHOTOS, {
    photos: field(K.USER_DEFAULT_PHOTOS, t.object({
      ids: field(K.USER_DEFAULT_PHOTOS_IDS, t.array(t.string))
    }))
  }),

  wrongFileType: serverPacket(K.WRONG_FILE_TYPE, {}),
  serverLanguageSet: serverPacket(K.SERVER_LANGUAGE, {}),

  /** через сколько секунд язык можно сменить снова */
  serverLanguageTimeError: serverPacket(K.SET_SERVER_LANGUAGE_TIME_ERROR, {
    time: field(K.DATA, t.number)
  })
};
