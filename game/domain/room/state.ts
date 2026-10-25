import type { ServerData } from "@common/protocol";
import Events from "@common/utils/emitter";
import { MessageList } from "../chat/message";
import { normalizeDecorations, type Decorations } from "../decorations";
import { Role, mafiaRoles } from "../enums";

type Statistics = ServerData<"roomStatistics">["statistics"];
type PlayerUpdate = ServerData<"userData">["players"][number];
type StatusData = ServerData<"gameStatus">["status"];
type RosterPlayer = NonNullable<Statistics["players"]>[number];

/** фаза комнаты: статус сервера 0, 2, 3, 4 */
export type Phase = "registration" | "preparation" | "game" | "finished";

export interface RoomSettings {
  id: string
  /** нужен для ходов и сообщений в комнате */
  modelType: number
  title: string
  minPlayers: number
  maxPlayers: number
  minLevel: number
  vip: boolean
  /** дополнительные роли комнаты */
  roles: number[]
  /** создатель комнаты (хост), если сервер его прислал */
  creator?: string
}

export interface LobbyPlayer {
  userObjectId?: string
  playerObjectId: string
  username: string
  photo?: string
  vip?: string
  decorations?: Decorations
}

export interface GamePlayer extends LobbyPlayer {
  /** порядковый номер за столом (с нуля) */
  index: number
  alive: boolean
  role?: number
  /** роль, которую игрок пометил сам («мне кажется, это шериф») */
  preRole?: number
  affectedByRoles: number[]
  isDayActionUsed?: boolean
  isNightActionAlternative?: boolean
  isNightActionUsed?: boolean
  /** голосов против игрока */
  vote: number
}

export interface PlayersStat {
  mafiaAll?: number
  mafiaAlive?: number
  civilianAll?: number
  civilianAlive?: number
  /** признак можно сдаться от сервера; пока его нет, считаем по числу игроков */
  canGiveUp?: boolean
}

export const isMafia = (role: number | undefined) => mafiaRoles.includes((role ?? Role.Civilian) as Role);

const vipText = (vip: unknown) => typeof vip == "string" && vip ? vip : undefined;

function toLobbyPlayer(raw: RosterPlayer | undefined): LobbyPlayer | undefined {
  const user = raw?.user?.playerUser ?? raw?.user;
  if(!user?.playerObjectId) return undefined;
  return { userObjectId: raw?.objectId ?? raw?.user?.objectId, playerObjectId: user.playerObjectId, username: user.username ?? "", photo: user.photo, vip: vipText(user.vip), decorations: normalizeDecorations(user.decorations) };
}

/**
 * всё, что игрок видит в комнате: кто за столом, роли, фаза, таймер, сообщения. Чистая логика без сети и DOM:
 * сессия подаёт сюда пакеты сервера, экран читает отсюда
 */
export class RoomState extends Events<{ change: () => void }> {
  /** 0 - регистрация, 2 - подготовка, 3 - игра, 4 - игра закончена */
  status = 0;
  /** 0, 1 - ночь, 2, 3 - день */
  dayTime = 2;
  timer = 0;
  lobby: LobbyPlayer[] = [];
  players: GamePlayer[] = [];
  stat: PlayersStat = {};
  /** сколько игроков каждой роли в этой игре */
  roleCounts?: Record<string, number>;
  readonly messages = new MessageList(300);
  /** пришло первое состояние комнаты */
  loaded = false;
  /** кто победил: известно из итогового сообщения игры */
  winner?: "mafia" | "peaceful" | "draw";
  /** роли других игроков от сервера; помним отдельно, пакет может прийти раньше стола */
  private known = new Map<string, number>();

  constructor(public settings: RoomSettings, public readonly myPlayerObjectId: string) {
    super();
  }

  get phase(): Phase { return this.status == 3 ? "game" : this.status == 4 ? "finished" : this.status == 2 ? "preparation" : "registration"; }
  /** игровой экран: идёт игра или она только что закончилась */
  get inGame() { return this.status >= 3; }
  get isNight() { return this.dayTime < 2; }
  get me(): GamePlayer | undefined { return this.players.find(player => player.playerObjectId == this.myPlayerObjectId); }

  changed() { this.emit("change"); }

  playerBy(id: string | undefined): GamePlayer | undefined {
    return id ? this.players.find(player => player.playerObjectId == id || player.userObjectId == id) : undefined;
  }

  // --- пакеты сервера ---

  applyStatus(status: StatusData) {
    this.status = status.status;
    if(status.timer !== undefined) this.timer = status.timer;
    if(status.dayTime !== undefined) this.dayTime = status.dayTime;
  }

  applyStatistics(stats: Statistics) {
    this.loaded = true;
    if(stats.gameStatus) this.applyStatus(stats.gameStatus);
    if(stats.roleCounts) this.roleCounts = stats.roleCounts;

    const roster = (stats.players ?? []).map(toLobbyPlayer).filter((player): player is LobbyPlayer => !!player);
    if(this.inGame) {
      // стол пересобирается только пока идёт игра и только если сервер прислал игроков:
      // в конце игры состояние приходит без списка, и пустой список стёр бы стол
      if(roster.length && this.status == 3) {
        // порядок за столом - порядок в списке; роли и состояние дополняет playersData
        const previous = new Map(this.players.map(player => [player.playerObjectId, player]));
        this.players = roster.map((player, index) => ({
          affectedByRoles: [], vote: 0, alive: true, ...previous.get(player.playerObjectId), ...player, index
        }));
        this.applyKnownRoles();
      }
      if(stats.playersData) this.applyPlayersData(stats.playersData);
    } else {
      this.lobby = roster;
    }
    this.changed();
  }

  /** обновление игроков: приходят только изменившиеся поля */
  applyPlayersData(updates: readonly PlayerUpdate[]) {
    for(const update of updates) {
      const player = this.playerBy(update.playerObjectId);
      if(!player) continue;
      if(update.alive !== undefined) player.alive = update.alive;
      if(update.affectedByRoles) player.affectedByRoles = update.affectedByRoles;
      if(update.isDayActionUsed !== undefined) player.isDayActionUsed = update.isDayActionUsed;
      if(update.isNightActionAlternative !== undefined) player.isNightActionAlternative = update.isNightActionAlternative;
      if(update.isNightActionUsed !== undefined) player.isNightActionUsed = update.isNightActionUsed;
      if(update.role !== undefined) player.role = update.role;
      if(update.vote !== undefined) player.vote = update.vote;
    }
    this.changed();
  }

  /** конец игры: роли всех игроков (приходят по id пользователя) */
  revealRoles(roles: readonly { userObjectId?: string, role?: number }[]) {
    for(const { userObjectId, role } of roles) {
      const player = this.playerBy(userObjectId);
      if(player && role !== undefined) player.role = role;
    }
    this.changed();
  }

  /** известные вам роли других игроков (мафия видит своих) */
  setKnownRoles(roles: readonly { playerObjectId?: string, role?: number }[]) {
    for(const { playerObjectId, role } of roles) {
      if(playerObjectId && role !== undefined) this.known.set(playerObjectId, role);
    }
    this.applyKnownRoles(true);
    this.changed();
  }

  /** раздаёт запомненные роли игрокам за столом; `force` - перезаписать и уже известные */
  private applyKnownRoles(force = false) {
    for(const player of this.players) {
      const role = this.known.get(player.playerObjectId);
      if(role !== undefined && (force || player.role === undefined)) player.role = role;
    }
  }

  setDayTime(dayTime: number, timer?: number) {
    this.dayTime = dayTime;
    if(timer !== undefined) this.timer = timer;
    this.changed();
  }

  setTimer(seconds: number) {
    this.timer = seconds;
    this.changed();
  }

  setStat(stat: PlayersStat) {
    this.stat = stat;
    this.changed();
  }

  /** пометка роли над игроком; `undefined` - снять */
  markRole(playerObjectId: string, role: number | undefined) {
    const player = this.playerBy(playerObjectId);
    if(player) player.preRole = role;
    this.changed();
  }

  /** полный список ожидающих (пакет «игроки в комнате») */
  setLobby(players: readonly RosterPlayer[]) {
    this.lobby = players.map(toLobbyPlayer).filter((player): player is LobbyPlayer => !!player);
    this.changed();
  }

  playerJoined(raw: RosterPlayer) {
    const player = toLobbyPlayer(raw);
    if(player && !this.lobby.some(other => other.playerObjectId == player.playerObjectId)) this.lobby = [...this.lobby, player];
    this.changed();
  }

  playerLeft(playerObjectId: string) {
    this.lobby = this.lobby.filter(player => player.playerObjectId != playerObjectId);
    this.changed();
  }

  /** состояние из сохранённой игры: стол, роли и счёт как в конце партии */
  restore(record: { playersData?: Record<string, unknown>, playersStat?: unknown, gameDayTime?: number }) {
    const saved = Object.values(record.playersData ?? {}) as Partial<GamePlayer>[];
    this.status = 4;
    this.dayTime = record.gameDayTime ?? 2;
    this.loaded = true;
    this.players = saved
      .filter(player => typeof player.playerObjectId == "string")
      .map((player, position) => ({
        playerObjectId: player.playerObjectId!, username: player.username ?? "", index: player.index ?? position, userObjectId: player.userObjectId,
        photo: player.photo, vip: player.vip, alive: player.alive ?? true, role: player.role, preRole: player.preRole,
        affectedByRoles: player.affectedByRoles ?? [], vote: player.vote ?? 0
      }))
      .sort((a, b) => a.index - b.index);

    const stat = record.playersStat as { ma?: number, m?: number, ca?: number, c?: number } | undefined;
    if(stat) this.stat = { mafiaAll: stat.ma, mafiaAlive: stat.m, civilianAll: stat.ca, civilianAlive: stat.c };
    this.changed();
  }

  // --- что показывать ---

  /** заголовок: до игры с числом игроков, в игре название */
  get title(): string {
    return this.inGame ? this.settings.title : `${this.settings.title} ${this.lobby.length} [${this.settings.minPlayers}/${this.settings.maxPlayers}]`;
  }

  /**
   * хост - создатель комнаты; если неизвестен - первый игрок по порядку;
   * если известен, но вышел из комнаты - хоста нет
   */
  get host(): { playerObjectId: string, username: string } | undefined {
    const players = this.inGame ? this.players : this.lobby;
    const { creator } = this.settings;
    const host = creator ? players.find(player => player.playerObjectId == creator || player.userObjectId == creator) : players[0];
    return host ? { playerObjectId: host.playerObjectId, username: host.username } : undefined;
  }

  /** итог игры от сервера: награда, активность (пакет `gf`) */
  finish?: { experience?: number, silver?: number, activity?: number, rating?: number, rewardItem?: unknown, rewardDecoration?: unknown }

  /** победила ли ваша команда; `undefined`, пока неизвестно (нет роли или итога) */
  get won(): boolean | undefined {
    const role = this.me?.role;
    if(!this.winner || this.winner == "draw" || role === undefined) return undefined;
    return (this.winner == "mafia") == isMafia(role);
  }

  /** вторая строка шапки: сколько игроков в комнате (до игры - ещё и сколько нужно и сколько влезет) */
  get playersLine(): string {
    return this.inGame ? `Игроки в комнате: ${this.players.length}` : `Игроки в комнате: ${this.lobby.length} [${this.settings.minPlayers}/${this.settings.maxPlayers}]`;
  }

  /** строка над списком игроков до начала игры */
  get info(): string {
    if(this.phase == "registration" && this.timer <= 0) return "Регистрация";
    return this.status == 2 ? `Подготовка через ${this.timer}` : this.timer > 0 ? `Игра начнётся через ${this.timer}` : "Регистрация";
  }

  /** сдаться: решает сервер (`mgu`), без него по числу игроков и остатку команды */
  get canGiveUp(): boolean {
    const me = this.me;
    if(!me?.alive) return false;
    if(this.stat.canGiveUp !== undefined) return this.stat.canGiveUp;
    if(this.players.length <= 7) return false;
    const { mafiaAlive, civilianAlive } = this.stat;
    return (mafiaAlive == 1 && isMafia(me.role)) || (civilianAlive == 1 && !isMafia(me.role)) || (mafiaAlive == 1 && civilianAlive == 1);
  }

  /**
   * какое действие вы можете выполнить над игроком сейчас: имя картинки действия или `undefined`
   * зависит от роли и времени суток (0 - любовница, 1 - мафия, 2 - телохранитель, 3 - голосование)
   */
  actionFor(target: GamePlayer): string | undefined {
    const me = this.me;
    if(!me || this.status != 3 || !me.alive || !target.alive || target.playerObjectId == me.playerObjectId) return undefined;

    const day = this.dayTime;
    let action = "";
    switch(me.role) {
      case Role.Doctor: if(day == 1) action = "_2"; break;
      case Role.Sheriff: if(day == 1 && !target.affectedByRoles.includes(Role.Sheriff)) action = "check"; break;
      case Role.Mafia: if(day == 1 && !isMafia(target.role)) action = "kill"; break;
      case Role.Lover: if(day == 0) action = "_5"; break;
      case Role.Terrorist: if(day == 3) action = "_6"; break;
      case Role.Journalist: if(day == 1 && !target.affectedByRoles.includes(Role.Journalist)) action = "_7"; break;
      case Role.Bodyguard: if(day == 2 && !me.isNightActionUsed) action = "_8"; break;
      case Role.Barman: if(day == 1) action = "_9"; break;
      case Role.Informer: if(day == 1 && !target.affectedByRoles.includes(Role.Informer)) action = "check"; break;
    }
    // днём все голосуют
    if(!action && day == 3) action = "kill";
    if(!action) return undefined;

    let used = day < 2 ? me.isNightActionUsed : me.isDayActionUsed;
    // напоённый барменом может сходить ещё раз
    if(day == 1 && me.affectedByRoles.includes(Role.Barman) && !me.isNightActionUsed) used = false;
    // сервер отмечает дневное действие напоённого использованным, поэтому телохранителя проверяем отдельно:
    // защита от этого не зависит (баг старой версии: напоённый телохранитель не мог никого защитить)
    if(day == 2 && me.role == Role.Bodyguard && me.affectedByRoles.includes(Role.Barman) && !me.isNightActionUsed) used = false;
    return used ? undefined : action;
  }

  /** как «горит» таймер: чем меньше времени, тем тревожнее */
  get timerLevel(): "normal" | "warning" | "danger" | "critical" {
    return this.timer <= 5 ? "critical" : this.timer <= 10 ? "danger" : this.timer <= 15 ? "warning" : "normal";
  }
}
