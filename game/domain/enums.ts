export enum Sex {
  Male = 0,
  Female = 1
}

export enum Role {
  Civilian = 1,
  Doctor = 2,
  Sheriff = 3,
  Mafia = 4,
  Lover = 5,
  Terrorist = 6,
  Journalist = 7,
  Bodyguard = 8,
  Barman = 9,
  Spy = 10,
  Informer = 11
}

export const roleNames: Record<Role, string> = {
  [Role.Civilian]: "Овощ",
  [Role.Doctor]: "Доктор",
  [Role.Sheriff]: "Шериф",
  [Role.Mafia]: "Мафия",
  [Role.Lover]: "Любовница",
  [Role.Terrorist]: "Террорист",
  [Role.Journalist]: "Журналист",
  [Role.Bodyguard]: "Телохранитель",
  [Role.Barman]: "Бармен",
  [Role.Spy]: "Шпион",
  [Role.Informer]: "Информатор"
};

export const mafiaRoles: readonly Role[] = [Role.Mafia, Role.Terrorist, Role.Barman, Role.Informer];
export const peacefulRoles: readonly Role[] = [Role.Civilian, Role.Doctor, Role.Sheriff, Role.Lover, Role.Journalist, Role.Bodyguard, Role.Spy];

/** тип сообщения в чате комнаты: номера как на проводе (сверены с apk и трафиком) */
export enum MessageType {
  MainText = 1,
  UserHasEntered = 2,
  UserHasLeft = 3,
  GameHasStarted = 4,
  NightComeMafiaInChat = 6,
  NightMafiaChooseVictim = 7,
  DayComeEveryoneInChat = 8,
  DayCiviliansVoting = 9,
  VotesFor = 10,
  MainText10 = 11,
  KilledPlayerMessage = 12,
  PlayerKilled = 13,
  VotesFor13 = 14,
  NobodyKilled = 15,
  GameFinishedCiviliansWon = 16,
  GameFinishedMafiaWon = 17,
  /** сообщение убитого в его чате; номер 17 общий с победой мафии, различается наличием игрока */
  KilledUserMessage = 17,
  TerroristBombed = 19,
  BreakingNewsPlayingTheSameTeam = 20,
  BreakingNewsPlayingDifferentTeams = 21,
  TerroristBombedUserWasUnderGuardian = 22,
  /** ничья: системное сообщение без игрока, номер 22 общий с телохранителем */
  GameFinishedInDraw = 22,
  StartedVotingToKickUser = 24,
  KickVotingHasFinished = 25,
  MainText25 = 26,
  VotesFor26 = 27,
  GiveUp = 28
}

/** цвет сообщения пользователя в чате */
export enum MessageStyle {
  NoColor = 0,
  Grey = 1,
  Blue = 2,
  Red = 3,
  Green = 4,
  Purple = 5,
  Yellow = 6,
  Pink = 7
}
