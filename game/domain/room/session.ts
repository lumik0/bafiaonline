import type { ServerClient } from "@common/net";
import { parseChatMessage, type ServerMessage } from "@common/protocol";
import type { GameSettings } from "@common/storage";
import Events from "@common/utils/emitter";
import { applyBarmanEffect } from "../chat/message";
import { withRecord, type HistoryFile, type HistoryRecord } from "../history";
import type { DocumentStore } from "../store";
import { toRoomEntry } from "./messages";
import { RoomState, type RoomSettings } from "./state";

type Handle = { remove(): void };
export type EndReason = "doubleAccount" | "kicked";

export interface SessionDeps {
  client: ServerClient
  history: DocumentStore<HistoryFile>
  settings: DocumentStore<GameSettings>
  myPlayerObjectId: string
}

/** голосование за исключение игрока, идущее сейчас */
export interface KickVote {
  targetPlayerObjectId?: string
  timer: number
  /** вы уже проголосовали */
  voted: boolean
}

/**
 * участие в одной комнате: подписка на пакеты, действия игрока и сохранение истории
 * создаётся сразу при входе, ещё до показа экрана, чтобы не потерять пакеты во время анимации перехода
 */
export class RoomSession extends Events<{ change: () => void, ended: (reason: EndReason) => void, over: () => void, notice: (text: string) => void }> {
  readonly state: RoomState;
  kickVote?: KickVote;
  private handle?: Handle;
  /** сообщения в том виде, как их присылал сервер: нужны для истории */
  private rawMessages: unknown[] = [];
  /** уже показанные сообщения (сырые): статистика присылает историю заново */
  private seen = new Set<string>();
  private lastStat?: unknown;
  private gotStatistics = false;
  private saved = false;
  private finishedEmitted = false;
  /** запись этой игры в истории: роли иногда раскрываются уже после сохранения, запись дополняем */
  private record?: HistoryRecord;
  private left = false;
  /** просмотр сохранённой игры: сети нет, ходить и писать нельзя */
  readonly replay: boolean;

  constructor(private deps: SessionDeps, settings: RoomSettings, replay = false) {
    super();
    this.replay = replay;
    this.state = new RoomState(settings, deps.myPlayerObjectId);
    this.state.on("change", () => this.emit("change"));
  }

  /** просмотр игры из истории: состояние собирается из записи, сеть не нужна */
  static fromHistory(deps: SessionDeps, record: HistoryRecord, id: string): RoomSession {
    const session = new RoomSession(deps, {
      id, modelType: record.modelType ?? 0, title: record.title ?? "Игра", minPlayers: record.minPlayers ?? 1, maxPlayers: record.maxPlayers ?? 8,
      minLevel: record.minLevel ?? 1, vip: !!record.isVipEnabled, roles: record.selectedRoles ?? []
    }, true);
    session.state.restore(record);
    for(const wire of record.messages ?? []) {
      try {
        session.state.messages.add(toRoomEntry(parseChatMessage(wire)));
      } catch {
        // повреждённое сообщение в старой записи пропускаем
      }
    }
    return session;
  }

  get roomId() { return this.state.settings.id; }

  /** `first` - ответ сервера на вход: в нём уже может быть состояние комнаты */
  start(first?: ServerMessage) {
    const { client } = this.deps;
    this.handle = client.on("message", message => this.receive(message));

    if(first) this.receive(first);
    // игрока создаём после входа: сервер тогда присылает состояние комнаты
    client.send("createPlayer", { roomId: this.roomId, modelType: this.state.settings.modelType });
  }

  /** связь вернулась: сервер забыл игрока, садимся за стол заново (как официальное приложение) */
  rejoin() {
    if(this.replay || this.left || this.state.status == 4) return;
    this.kickVote = undefined;
    this.deps.client.send("createPlayer", { roomId: this.roomId, modelType: this.state.settings.modelType });
    this.emit("change");
  }

  private receive(message: ServerMessage) {
    const { state } = this;
    switch(message.name) {
      case "roomStatistics": return this.statistics(message.data.statistics);
      case "chatMessage": return this.addMessage(message.data.message, (message.raw as { m?: unknown }).m);
      case "chatUsers": return state.inGame ? undefined : state.setLobby(message.data.users);
      case "playerJoined": return state.inGame ? undefined : state.playerJoined(message.data.player);
      case "playerLeft": return state.inGame ? undefined : state.playerLeft(message.data.playerObjectId);
      case "timer": return state.setTimer(message.data.seconds);
      case "playersStat": {
        this.lastStat = message.raw;
        const { canGiveUp, ...counts } = message.data;
        return state.setStat({ ...counts, canGiveUp: canGiveUp === undefined ? undefined : !!canGiveUp });
      }
      case "gameStatus": state.applyStatus(message.data.status); state.changed(); return this.maybeSave();
      case "gameDayTime": return state.setDayTime(message.data.dayTime, message.data.timer);
      case "userData": return state.applyPlayersData(message.data.players);
      case "rolesRevealed": state.revealRoles(message.data.roles); return this.refreshRecord();
      case "knownRoles": return state.setKnownRoles(message.data.players);
      case "kickVoteStarted": return this.startKickVote(message.data.playerObjectId, message.data.timer ?? 10);
      case "kickVoteTimer": return this.kickTimer(message.data.timer);
      case "gameFinished": {
        const { team, experience, silver, activity, rating, rewardItem, rewardDecoration } = message.data;
        state.finish = { experience, silver, activity, rating, rewardItem, rewardDecoration };
        if(team !== undefined) state.winner = team == 1 ? "peaceful" : team == 2 ? "mafia" : "draw";
        return;
      }
      case "userDoubleAccount": return this.emit("ended", "doubleAccount");
      case "userKicked": return this.emit("ended", "kicked");
      case "kickAlreadyStarted": return this.emit("notice", "Голосование за исключение уже идёт, дождись его конца");
      case "kickGameStarted": return this.emit("notice", "Пока идёт игра, выгонять игроков нельзя");
      case "kickNotInRoom": return this.emit("notice", "Этого игрока уже нет в комнате");
      case "kickPrice": return this.emit("notice", `Чтобы выгнать игрока, нужно серебра: ${message.data.silver}`);
      case "kickNotEnough": return this.emit("notice", `Не хватает серебра, чтобы выгнать игрока. У тебя: ${message.data.mine}, у него: ${message.data.theirs}`);
    }
  }

  private statistics(stats: Parameters<RoomState["applyStatistics"]>[0]) {
    this.state.applyStatistics(stats);

    // первый раз - сообщения комнаты целиком. Позже история приходит заново при смене фазы:
    // подготовка и конец игры переписку не трогают, начало игры заменяет её, если так выбрано в настройках
    const first = !this.gotStatistics;
    const touchesMessages = first || this.state.status == 3;
    if(touchesMessages) {
      if(first || this.deps.settings.data.game.clearMessages) {
        this.rawMessages = [];
        this.seen.clear();
        this.state.messages.replace([]);
      }
      for(const wire of stats.messages ?? []) this.addWire(wire, toRoomEntry(parseChatMessage(wire)));
    }
    this.gotStatistics = true;
    this.state.changed();
    this.maybeSave();
  }

  /** добавляет сообщение, если такого ещё не было */
  private addWire(wire: unknown, entry: ReturnType<typeof toRoomEntry>) {
    const key = JSON.stringify(wire);
    if(this.seen.has(key)) return;
    this.seen.add(key);
    this.rawMessages.push(wire);
    this.state.messages.add(entry);
    // итог игры приходит системным сообщением: 16 - победили мирные, 17 - мафия, 22 без игрока - ничья
    if(entry.type == 16) this.state.winner = "peaceful";
    else if(entry.type == 17) this.state.winner = "mafia";
    else if(entry.type == 22 && !entry.user && entry.kind == "system") this.state.winner = "draw";
  }

  private addMessage(message: Parameters<typeof toRoomEntry>[0], wire: unknown) {
    const entry = toRoomEntry(message);
    // как в старой версии: кнопки по самому сообщению, даже если пакет "ku" не дошёл или пришёл позже
    if(entry.kickVote && !this.kickVote) this.kickVote = { targetPlayerObjectId: entry.kickVote.targetPlayerObjectId, timer: 10, voted: false };
    else if(message.type == 25) this.kickVote = undefined;
    this.addWire(wire, entry);
    this.state.changed();
  }

  private startKickVote(targetPlayerObjectId: string | undefined, timer: number) {
    this.kickVote = { targetPlayerObjectId, timer, voted: false };
    this.emit("change");
  }

  private kickTimer(timer: number) {
    if(!this.kickVote) return;
    this.kickVote = timer < 1 ? undefined : { ...this.kickVote, timer };
    this.emit("change");
  }

  // --- действия игрока ---

  /** походить на игрока: убить, вылечить, проверить, проголосовать - смотря какая у вас роль и время суток */
  act(playerObjectId: string) {
    if(this.replay) return;
    this.deps.client.send("roleAction", { playerObjectId, roomId: this.roomId, modelType: this.state.settings.modelType });
    this.state.changed();
  }

  giveUp() {
    if(this.replay) return;
    this.deps.client.send("giveUp", { roomId: this.roomId });
  }

  send(text: string) {
    if(this.replay) return;
    const message = applyBarmanEffect(text, this.deps.settings.data.game.barmanEffect);
    if(!message.trim()) return;
    this.deps.client.send("sendRoomMessage", { message: { text: message, style: 0, sticker: false }, roomId: this.roomId, modelType: this.state.settings.modelType });
  }

  voteKick(vote: boolean) {
    if(this.replay) return;
    this.deps.client.send("voteKick", { roomId: this.roomId, vote });
    if(this.kickVote) this.kickVote = { ...this.kickVote, voted: true };
    this.emit("change");
  }

  /** выйти из комнаты и отписаться от пакетов */
  leave() {
    if(this.left || this.replay) return;
    this.left = true;
    this.handle?.remove();
    try {
      this.deps.client.send("leaveRoom", { roomId: this.roomId });
    } catch {
      // связи нет - сервер сам уберёт игрока
    }
  }

  // --- история ---

  /** игра закончилась: сохраняем в историю, если включено в настройках (один раз) */
  private maybeSave() {
    // игра закончилась: сообщаем один раз (окно «Игра окончена»), даже если историю сохранять не нужно
    if(this.state.status == 4 && !this.replay && !this.finishedEmitted) {
      this.finishedEmitted = true;
      this.emit("over");
    }
    if(this.state.status != 4 || this.saved || !this.deps.settings.data.game.saveHistory) return;
    this.saved = true;
    const { settings } = this.state;
    const record: HistoryRecord = {
      messages: this.rawMessages, playersStat: this.lastStat, playersData: this.snapshotPlayers(), modelType: settings.modelType, title: settings.title,
      maxPlayers: settings.maxPlayers, minPlayers: settings.minPlayers, minLevel: settings.minLevel, isVipEnabled: settings.vip,
      selectedRoles: settings.roles, gameDayTime: this.state.dayTime, createdAt: Date.now()
    };
    this.record = record;
    this.deps.history.update(history => { history.rooms = withRecord(history.rooms, record); });
    void this.deps.history.flush();
  }

  private snapshotPlayers() {
    return Object.fromEntries(this.state.players.map(player => [player.playerObjectId, { ...player }]));
  }

  /** роли раскрылись после того, как игра сохранена: дописываем их в запись */
  private refreshRecord() {
    if(!this.record) return;
    this.record.playersData = this.snapshotPlayers();
    this.deps.history.update(() => {});
    void this.deps.history.flush();
  }
}
