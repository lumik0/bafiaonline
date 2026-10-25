import { field, optionalField, serverPacket, t } from "../define";
import { K } from "../keys";
import { chatUser } from "./chat";

/** состояние одного игрока в игре; в обновлениях приходят только изменившиеся поля */
export const playerData = t.object({
  playerObjectId: optionalField(K.PLAYER_OBJECT_ID, t.string),
  alive: optionalField(K.ALIVE, t.boolean),
  /** роли, которые на игрока подействовали (видно ему самому) */
  affectedByRoles: optionalField(K.AFFECTED_BY_ROLES, t.array(t.number)),
  isDayActionUsed: optionalField(K.IS_DAY_ACTION_USED, t.boolean),
  isNightActionAlternative: optionalField(K.IS_NIGHT_ACTION_ALTERNATIVE, t.boolean),
  isNightActionUsed: optionalField(K.IS_NIGHT_ACTION_USED, t.boolean),
  role: optionalField(K.ROLE, t.number),
  /** сколько голосов против игрока */
  vote: optionalField(K.VOTE, t.number)
});

/** игрок комнаты: `user` - его профиль, `objectId` - id пользователя */
const roomPlayer = t.object({
  objectId: optionalField(K.OBJECT_ID, t.string),
  user: optionalField(K.PLAYER_USER, chatUser)
});

const gameStatus = t.object({
  /** 0 - регистрация, 2 - подготовка, 3 - игра, 4 - игра закончена */
  status: field(K.STATUS, t.numeric),
  timer: optionalField(K.TIMER, t.numeric),
  /** 0, 1 - ночь, 2, 3 - день */
  dayTime: optionalField(K.DAYTIME, t.numeric)
});

export const gameMessages = {
  /** состояние комнаты при входе и при смене фазы */
  roomStatistics: serverPacket(K.ROOM_STATISTICS, {
    statistics: field(K.ROOM_STATISTICS, t.object({
      messages: optionalField(K.MESSAGES, t.array(t.any)),
      players: optionalField(K.PLAYERS, t.array(roomPlayer)),
      gameStatus: optionalField(K.GAME_STATUS, gameStatus),
      playersData: optionalField(K.PLAYERS_DATA, t.array(playerData)),
      /** сколько игроков каждой роли в этой игре: роль → количество */
      roleCounts: optionalField("rls", t.record(t.numeric))
    }))
  }),
  gameStatus: serverPacket(K.GAME_STATUS, { status: field(K.GAME_STATUS, gameStatus) }),
  /** новая фаза: смена дня и ночи */
  gameDayTime: serverPacket(K.GAME_DAYTIME, {
    dayTime: field(K.DAYTIME, t.numeric),
    timer: optionalField(K.TIMER, t.numeric)
  }),
  playersStat: serverPacket(K.PLAYERS_STAT, {
    /** сервер сам говорит, можно ли сдаться */
    canGiveUp: optionalField("mgu", t.flag),
    mafiaAll: optionalField(K.MAFIA_ALL, t.numeric),
    mafiaAlive: optionalField(K.MAFIA_ALIVE, t.numeric),
    civilianAll: optionalField(K.CIVILIAN_ALL, t.numeric),
    civilianAlive: optionalField(K.CIVILIAN_ALIVE, t.numeric)
  }),
  userData: serverPacket(K.USER_DATA, { players: field(K.PLAYERS_DATA, t.array(playerData)) }),
  /** роли раскрыты (конец игры): по id пользователя */
  rolesRevealed: serverPacket(K.ROLES, {
    roles: field(K.ROLES, t.array(t.object({
      userObjectId: optionalField(K.USER_OBJECT_ID, t.string),
      role: optionalField(K.ROLE, t.number)
    })))
  }),
  /** роли, известные вам о других игроках (мафия видит своих) */
  knownRoles: serverPacket(K.PLAYER_ROLES, {
    players: field(K.PLAYER_ROLES, t.array(t.object({
      playerObjectId: optionalField(K.PLAYER_OBJECT_ID, t.string),
      role: optionalField(K.ROLE, t.number)
    })))
  }),
  /** итог игры (разобрано по клиенту официального приложения): награда и кто победил */
  gameFinished: serverPacket(K.GAME_FINISHED, {
    experience: optionalField(K.EXPERIENCE, t.numeric),
    /** серебряные монеты за игру */
    silver: optionalField("scns", t.numeric),
    /** кто победил: 0 - ничья, 1 - мирные, 2 - мафия */
    team: optionalField(K.TEAM, t.numeric),
    /** активность игрока в игре, % */
    activity: optionalField(K.ACTIVITY, t.numeric),
    /** изменение рейтинга соревновательного режима */
    rating: optionalField(K.MATCH_MAKING_SCORE, t.numeric),
    /** дополнительная награда: предмет (`rwdi`) или украшение (`rwdd`) рюкзака */
    rewardItem: optionalField("rwdi", t.any),
    rewardDecoration: optionalField("rwdd", t.any)
  }),
  playerJoined: serverPacket(K.ADD_PLAYER, { player: field(K.PLAYER, roomPlayer) }),
  playerLeft: serverPacket(K.REMOVE_PLAYER, { playerObjectId: field(K.PLAYER_OBJECT_ID, t.string) }),
  /** начато голосование за исключение игрока */
  kickVoteStarted: serverPacket(K.KICK_USER, {
    playerObjectId: optionalField(K.PLAYER_OBJECT_ID, t.string),
    timer: optionalField(K.TIMER, t.numeric)
  }),
  kickVoteTimer: serverPacket(K.KICK_TIMER, { timer: field(K.TIMER, t.numeric) }),
  /** отказы на попытку выгнать игрока */
  kickAlreadyStarted: serverPacket(K.KICK_USER_STARTED, {}),
  kickGameStarted: serverPacket(K.KICK_USER_GAME_STARTED, {}),
  kickNotInRoom: serverPacket(K.KICK_USER_NOT_IN_ROOM, {}),
  /** сколько серебра нужно, чтобы выгнать */
  kickPrice: serverPacket(K.KICK_USER_RANK, { silver: field(K.USER_RANK, t.numeric) }),
  /** серебра у вас меньше, чем у игрока, которого выгоняете */
  kickNotEnough: serverPacket(K.KICK_USER_AUTHORITY_LESS_THAN_USER, {
    mine: field(K.USER_RANK, t.numeric),
    theirs: field(K.USER_RANK_FOR_KICK, t.numeric)
  })
};
