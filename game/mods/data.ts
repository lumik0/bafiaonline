import type { PlayerProfile } from "../domain/profile";
import type { RoomItem } from "../domain/rooms/room";
import type { PlayerView } from "../domain/room/views";
import { roleNames, type Role } from "../domain/enums";
import type { RoomSession } from "../domain/room/session";

export const roomMenuData = (room: RoomItem) => ({
  id: room.id, title: room.title, playersNum: room.playersNum, minPlayers: room.minPlayers, maxPlayers: room.maxPlayers,
  minLevel: room.minLevel, status: room.status, hasPassword: room.hasPassword, vip: room.vip, friendsInRoom: room.friendsInRoom
});

export const playerMenuData = (view: PlayerView) => ({
  index: view.index, username: view.username, playerObjectId: view.playerObjectId, alive: view.alive,
  role: view.role || undefined, roleName: view.role ? roleNames[view.role as Role] : undefined, action: view.action
});

export const profileData = (profile: PlayerProfile, playerObjectId: string, isMe: boolean) => ({
  playerObjectId,
  username: profile.user.username ?? "",
  isMe,
  level: profile.user.level ?? 1,
  playedGames: profile.user.playedGames ?? 0,
  winsAsMafia: profile.user.winsAsMafia ?? 0,
  winsAsPeaceful: profile.user.winsAsPeaceful ?? 0,
  roleStatistics: profile.user.roleStatistics ?? {},
  matchMakingScore: profile.user.matchMakingScore ?? 0
});

export const roomInfoData = (session: RoomSession) => {
  const { settings, host } = session.state;
  return { id: settings.id, title: settings.title, minPlayers: settings.minPlayers, maxPlayers: settings.maxPlayers, minLevel: settings.minLevel, vip: settings.vip, roles: settings.roles, host };
};

export const gameOverData = (session: RoomSession) => {
  const finish = session.state.finish;
  return {
    ...roomInfoData(session), winner: session.state.winner, won: session.state.won,
    experience: finish?.experience, silver: finish?.silver, rating: finish?.rating, activity: finish?.activity
  };
};
