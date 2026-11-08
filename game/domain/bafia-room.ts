import type { BafiaRoomEvent, BafiaRoomInfo, BafiaRoomState } from "@common/bafia/protocol";
import { decode, type ServerMessage } from "@common/protocol";
import type { ServerClient } from "@common/net";
import { Role } from "./enums";
import type { RoomSettings } from "./room/state";

/** что адаптеру нужно от связи с сервером Бафии: ходы игрока и события комнаты */
export interface BafiaRoomLink {
  act(targets: string[]): Promise<{ ok: boolean, reason?: string }>
  bomb(target: string): Promise<{ ok: boolean, reason?: string }>
  chat(text: string): Promise<{ ok: boolean, reason?: string }>
  leave(): Promise<unknown>
  /** подписка на события этой комнаты и на её закрытие; возвращает отписку */
  subscribe(room: string, onEvents: (events: BafiaRoomEvent[]) => void, onClosed: () => void): () => void
}

type Listener = (message: ServerMessage) => void;

/**
 * Комната Бафии в виде официальной: движок на сервере Бафии шлёт свои события, а экран комнаты умеет только пакеты официального сервера.
 * Адаптер превращает события в такие пакеты (стол, чат, роли, таймер работают без изменений) и действия экрана (ход, сообщение, выход) - в запросы к Бафии.
 * `client` - то, что нужно отдать сессии комнаты вместо настоящего клиента
 */
export class BafiaRoomAdapter {
  readonly client: Pick<ServerClient, "on" | "send" | "request"> & { adapter: BafiaRoomAdapter };
  private listeners = new Set<Listener>();
  private names = new Map<string, string>();
  private roster: { id: string, nick: string, alive: boolean }[];
  private role?: number;
  private known = new Map<string, number>();
  private votes: Record<string, number> = {};
  private snapshot: BafiaRoomState;
  private unsubscribe?: () => void;
  private closed = false;
  /** журналист выбирает двоих: первый ждёт второго */
  private firstTarget?: string;
  private dayTime: number;
  private status: 0 | 3 | 4;
  onClosed?: () => void;

  /** я создатель комнаты (закрыть её может только он) */
  get isHost() { return !this.spectator && this.snapshot.host == this.you; }

  /** зритель: за столом его нет, на экране он выглядит выбывшим игроком, который не может писать и ходить */
  readonly spectator: boolean;

  constructor(private link: BafiaRoomLink, readonly info: BafiaRoomInfo, readonly you: string, state: BafiaRoomState) {
    this.spectator = !!state.spectator;
    this.snapshot = state;
    this.roster = this.seat(state);
    for(const player of state.players) this.names.set(player.id, player.nick);
    this.role = state.role;
    for(const known of state.known) this.known.set(known.id, known.role);
    this.dayTime = state.dayTime;
    this.status = state.status;
    this.client = {
      adapter: this,
      on: ((event: string, listener: Listener) => {
        if(event == "message") this.listeners.add(listener);
        return { remove: () => { this.listeners.delete(listener); } };
      }) as never,
      send: ((name: string, data: Record<string, unknown>) => this.outgoing(name, data)) as never,
      request: (() => Promise.reject(new Error("В комнате Бафии это недоступно"))) as never
    };
    this.unsubscribe = link.subscribe(info.id, events => this.apply(events), () => this.close());
  }

  private seat(state: BafiaRoomState) {
    const roster = state.players.map(player => ({ ...player }));
    if(state.spectator) { roster.push({ id: this.you, nick: "Ты (зритель)", alive: false }); this.names.set(this.you, "Ты (зритель)"); }
    return roster;
  }

  /** настройки для сессии комнаты: то же, что приходит от официального сервера при входе */
  settings(): RoomSettings {
    return { id: this.info.id, modelType: 0, title: this.info.title, minPlayers: this.info.minPlayers, maxPlayers: this.info.maxPlayers, minLevel: 1, vip: false, roles: [], creator: this.snapshot.host };
  }

  /** связь с сервером вернулась и игрок снова за столом: показываем свежее состояние (кто жив, этап, роль) */
  resync(state: BafiaRoomState) {
    this.snapshot = state;
    this.roster = this.seat(state);
    for(const player of state.players) this.names.set(player.id, player.nick);
    this.role = state.role;
    for(const known of state.known) this.known.set(known.id, known.role);
    this.status = state.status;
    this.dayTime = state.dayTime;
    this.votes = {};
    this.deliver(this.full(state.timer));
    if(state.stat) this.deliver({ ty: "ps", m: state.stat.mafiaAlive, ma: state.stat.mafiaAll, c: state.stat.civilianAlive, ca: state.stat.civilianAll });
  }

  /** комната закрылась или игрок вышел: подписки снимаются */
  close() {
    if(this.closed) return;
    this.closed = true;
    this.unsubscribe?.();
    this.listeners.clear();
    this.onClosed?.();
  }

  // --- от сервера Бафии к экрану ---

  private deliver(packet: Record<string, unknown>) {
    const message = decode(JSON.stringify(packet));
    for(const listener of [...this.listeners]) listener(message);
  }

  private user(id: string | undefined) {
    const nick = id ? this.names.get(id) : undefined;
    return id && nick ? { u: nick, puo: id } : undefined;
  }

  private players() {
    return this.roster.map(player => ({ o: player.id, pu: { puo: player.id, u: player.nick } }));
  }

  /** состояние игроков для стола: кто жив, моя роль и известные мне, голоса */
  private data() {
    return this.roster.map(player => {
      const role = player.id == this.you ? this.role : this.known.get(player.id);
      return { puo: player.id, a: player.alive, ...(role !== undefined ? { r: role } : {}), ...(this.votes[player.id] ? { v: this.votes[player.id] } : {}) };
    });
  }

  /** полная картина комнаты, как при входе в официальную */
  private full(timer = this.snapshot.timer) {
    const started = this.status != 0;
    return {
      ty: "rst",
      rst: {
        gs: { s: this.status, t: timer, d: this.dayTime }, pls: this.players(),
        ...(started ? { data: this.data(), rls: this.snapshot.roleCounts } : {}), ms: []
      }
    };
  }

  private apply(events: BafiaRoomEvent[]) {
    for(const event of events) {
      switch(event.kind) {
        case "joined":
          this.names.set(event.player.id, event.player.nick);
          if(!this.roster.some(player => player.id == event.player.id)) this.roster.push({ ...event.player });
          this.deliver({ ty: "ap", p: { o: event.player.id, pu: { puo: event.player.id, u: event.player.nick } } });
          break;
        case "left":
          this.roster = this.roster.filter(player => player.id != event.id);
          this.deliver({ ty: "rp", puo: event.id });
          break;
        case "message": {
          const user = event.anonymous ? undefined : this.user(event.from);
          this.deliver({ ty: "m", m: { tx: event.text, t: event.type, ...(user ? { uu: user } : {}) } });
          break;
        }
        case "phase": {
          const starting = this.status == 0 && event.status == 3;
          this.status = event.status;
          this.dayTime = event.dayTime;
          this.firstTarget = undefined;
          // этап сменился: ходы снова доступны, прошлые голоса сняты
          this.votes = {};
          if(event.roleCounts) this.snapshot = { ...this.snapshot, roleCounts: event.roleCounts };
          // игра началась: стол собирается заново, как при начале игры в официальной
          if(starting) { this.deliver(this.full(event.timer)); break; }
          this.deliver({ ty: "gs", gs: { s: event.status, t: event.timer, d: event.dayTime } });
          this.deliver({ ty: "gd", d: event.dayTime, t: event.timer });
          this.deliver({ ty: "ud", data: this.roster.map(player => ({ puo: player.id, v: 0, ...(player.id == this.you ? { idau: false, inau: false } : {}) })) });
          break;
        }
        case "role":
          this.role = event.role;
          this.deliver({ ty: "ud", data: [{ puo: this.you, r: event.role, a: true }] });
          break;
        case "known": {
          // роли перемешались или кто-то сменил команду: прежние знания стираются, на столе они снова «неизвестны»
          if(event.reset) this.known.clear();
          for(const player of event.players) this.known.set(player.id, player.role);
          if(event.players.length || event.reset) this.deliver({ ty: "rls", rls: event.players.map(player => ({ puo: player.id, r: player.role })), ...(event.reset ? { rset: true } : {}) });
          break;
        }
        case "check":
          this.known.set(event.target, event.role);
          this.deliver({ ty: "ud", data: [{ puo: event.target, r: event.role }] });
          break;
        case "death": {
          const dead = this.roster.find(player => player.id == event.id);
          if(dead) dead.alive = false;
          if(event.role !== undefined) this.known.set(event.id, event.role);
          this.deliver({ ty: "ud", data: [{ puo: event.id, a: false, ...(event.role !== undefined ? { r: event.role } : {}) }] });
          break;
        }
        case "timer": this.deliver({ t: event.timer }); break;
        case "stat": this.deliver({ ty: "ps", m: event.mafiaAlive, ma: event.mafiaAll, c: event.civilianAlive, ca: event.civilianAll }); break;
        case "votes": {
          const before = this.votes;
          this.votes = event.counts;
          const ids = new Set([...Object.keys(before), ...Object.keys(event.counts)]);
          if(ids.size) this.deliver({ ty: "ud", data: [...ids].map(id => ({ puo: id, v: event.counts[id] ?? 0 })) });
          break;
        }
        case "end":
          this.status = 4;
          for(const player of event.roles) this.known.set(player.id, player.role);
          this.deliver({ ty: "gs", gs: { s: 4, t: 0 } });
          this.deliver({ ty: "gf", t: event.winner == "peaceful" ? 1 : 2 });
          this.deliver({ ty: "roles", roles: event.roles.map(player => ({ uo: player.id, r: player.role })) });
          this.deliver({ ty: "ud", data: event.roles.map(player => ({ puo: player.id, r: player.role })) });
          break;
      }
    }
  }

  // --- от экрана к серверу Бафии ---

  private outgoing(name: string, data: Record<string, unknown>) {
    if(this.spectator && (name == "sendRoomMessage" || name == "roleAction")) {
      if(name == "sendRoomMessage") this.deliver({ ty: "m", m: { tx: "Ты смотришь игру со стороны: писать нельзя", t: 1 } });
      return;
    }
    switch(name) {
      case "createPlayer": return void queueMicrotask(() => {
        if(this.closed) return;
        this.deliver(this.full());
        // прежний чат комнаты: вышел и вернулся, или пришёл зрителем
        for(const message of this.snapshot.history ?? []) {
          const user = message.anonymous ? undefined : this.user(message.from);
          this.deliver({ ty: "m", m: { tx: message.text, t: message.type, ...(user ? { uu: user } : {}) } });
        }
        const stat = this.snapshot.stat;
        if(stat) this.deliver({ ty: "ps", m: stat.mafiaAlive, ma: stat.mafiaAll, c: stat.civilianAlive, ca: stat.civilianAll });
      });
      case "roleAction": return void this.action(String(data.playerObjectId ?? ""));
      case "sendRoomMessage": return void this.link.chat(String((data.message as { text?: unknown } | undefined)?.text ?? ""));
      case "leaveRoom": return void this.leave();
    }
  }

  private async leave() {
    await this.link.leave().catch(() => {});
    this.close();
  }

  /** ход по нажатию на игрока: в голосовании террорист взрывает, журналист ночью выбирает двоих, остальные - один выбор */
  private async action(target: string) {
    if(!target || this.closed) return;
    const marks = (day: boolean) => this.deliver({ ty: "ud", data: [{ puo: this.you, [day ? "idau" : "inau"]: true }] });
    if(this.role == Role.Terrorist && this.dayTime == 3) {
      const result = await this.link.bomb(target);
      return void (result.ok && marks(true));
    }
    if(this.role == Role.Journalist && this.dayTime == 1) {
      if(!this.firstTarget || this.firstTarget == target) { this.firstTarget = target; return; }
      const first = this.firstTarget;
      this.firstTarget = undefined;
      const result = await this.link.act([first, target]);
      return void (result.ok && marks(false));
    }
    const result = await this.link.act([target]);
    if(result.ok) marks(this.dayTime >= 2);
  }
}
