import { mafiaRoles, roleNames, type Role } from "../domain/enums";
import type { RoomState } from "../domain/room/state";

/** что вы можете сделать с игроком сейчас (по картинке действия в игре) */
const ACTIONS: Record<string, string> = { kill: "kill", check: "check", _2: "heal", _5: "love", _6: "explode", _7: "interview", _8: "guard", _9: "pour" };

const STEPS = ["lover", "night", "bodyguard", "vote"] as const;

export interface RoomSnapshot {
  id: string
  title: string
  /** registration - набор игроков, preparation - подготовка, game - идёт игра, finished - игра закончилась */
  phase: "registration" | "preparation" | "game" | "finished"
  /** секунд до конца этапа */
  timer: number
  /** только в игре */
  time?: "night" | "day"
  /** какая по счёту ночь или день: 1 или 2. Порядок такой: 1 ночь, 2 ночь, 1 день, 2 день */
  part?: 1 | 2
  /** четыре этапа по ролям: lover, night, bodyguard, vote */
  step?: typeof STEPS[number]
  me?: { index: number, role?: number, roleName?: string, alive: boolean }
  players: {
    index: number
    username: string
    playerObjectId: string
    alive: boolean
    /** роль, если вам она известна (свою, раскрытые, союзники по команде) */
    role?: number
    roleName?: string
    /** известно только вместе с ролью */
    mafia?: boolean
    votes: number
    /** что можно сделать с этим игроком сейчас (kill, check, heal и т.д.) */
    action?: string
  }[]
  /** хост: сервер его не сообщает, это первый игрок комнаты по порядку */
  host?: { playerObjectId: string, username: string }
  /** роль → сколько таких игроков в этой игре */
  roles?: Record<string, number>
}

const roleName = (role: number | undefined) => role === undefined ? undefined : roleNames[role as Role];

/** состояние комнаты в виде, удобном модам: без внутренних структур игры */
export function roomSnapshot(state: RoomState): RoomSnapshot {
  const me = state.me;
  const inGame = state.inGame;
  const roster = inGame ? state.players : state.lobby.map((player, index) => ({ ...player, index, alive: true, vote: 0, role: undefined, affectedByRoles: [] }));

  return {
    id: state.settings.id,
    title: state.title,
    phase: state.phase,
    timer: state.timer,
    time: state.status == 3 ? (state.isNight ? "night" : "day") : undefined,
    part: state.status == 3 ? (state.dayTime % 2 == 0 ? 1 : 2) : undefined,
    step: state.status == 3 ? STEPS[state.dayTime] : undefined,
    me: me && { index: me.index, role: me.role, roleName: roleName(me.role), alive: me.alive },
    players: roster.map(player => {
      const gamePlayer = inGame ? state.players.find(other => other.playerObjectId == player.playerObjectId) : undefined;
      const action = gamePlayer ? state.actionFor(gamePlayer) : undefined;
      return {
        index: player.index,
        username: player.username,
        playerObjectId: player.playerObjectId,
        alive: player.alive,
        role: player.role,
        roleName: roleName(player.role),
        mafia: player.role === undefined ? undefined : mafiaRoles.includes(player.role as Role),
        votes: player.vote,
        action: action ? ACTIONS[action] ?? action : undefined
      };
    }),
    host: state.host,
    roles: state.roleCounts
  };
}
