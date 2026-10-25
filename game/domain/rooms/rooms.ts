import type { ServerClient } from "@common/net";
import type { ServerMessage } from "@common/protocol";
import Events from "@common/utils/emitter";
import { md5salt } from "@common/utils/md5";
import { sortRooms, toRoom, type RoomItem } from "./room";

type Handle = { remove(): void };

export type JoinFailure = "wrongPassword" | "started" | "anotherRoom" | "doubleAccount" | "levelTooLow" | "kicked" | "full" | "notVip";
export type JoinResult =
  | { status: "ok", roomId?: string, first: ServerMessage }
  | { status: JoinFailure };

export const joinProblems: Record<JoinFailure, string> = {
  wrongPassword: "Неправильный пароль!",
  started: "Игра уже началась",
  anotherRoom: "Нельзя зайти: ты уже в другой комнате",
  doubleAccount: "В этой комнате уже есть игрок с твоим интернет-подключением.\nВозможно, ты пользуешься общей точкой доступа. Заходить с нескольких аккаунтов с одного подключения нельзя.",
  levelTooLow: "Твой уровень маленький",
  kicked: "Тебя выгнали из этой комнаты",
  full: "Комната переполнена",
  notVip: "Только VIP-игроки могут зайти в VIP-комнату"
};

const ENTER_REPLIES = ["roomEntered", "roomCreated", "roomStatistics", "roomPasswordWrong", "gameAlreadyStarted", "userInAnotherRoom", "userDoubleAccount", "userLevelNotEnough", "userKicked", "roomFull", "userNotVip"] as const;

const FAILURES: Partial<Record<ServerMessage["name"], JoinFailure>> = {
  roomPasswordWrong: "wrongPassword", gameAlreadyStarted: "started", userInAnotherRoom: "anotherRoom", userDoubleAccount: "doubleAccount",
  userLevelNotEnough: "levelTooLow", userKicked: "kicked", roomFull: "full", userNotVip: "notVip"
};

/** результат ответа сервера на вход или создание комнаты */
export function toJoinResult(message: ServerMessage): JoinResult {
  const failure = FAILURES[message.name];
  if(failure) return { status: failure };
  const room = message.name == "roomEntered" || message.name == "roomCreated" ? message.data.room : undefined;
  return { status: "ok", roomId: room?.id, first: message };
}

/** список комнат: приходит целиком, потом дополняется событиями */
export class RoomsList extends Events<{ change: () => void }> {
  private byId = new Map<string, RoomItem>();
  private handles: Handle[] = [];
  loaded = false;

  constructor(private client: ServerClient) {
    super();
  }

  get rooms(): RoomItem[] { return sortRooms([...this.byId.values()]); }

  /** комната из списка (после закрытия экрана список остаётся в памяти) */
  get(id: string): RoomItem | undefined { return this.byId.get(id); }

  open() {
    this.loaded = false;
    const update = (change: () => void) => { change(); this.emit("change"); };
    this.handles.push(
      this.client.on("rooms", data => update(() => {
        this.byId.clear();
        for(const info of data.rooms) {
          const room = toRoom(info);
          if(room) this.byId.set(room.id, room);
        }
        this.loaded = true;
      })),
      this.client.on("roomAdded", data => update(() => {
        const room = toRoom(data.room);
        if(room) this.byId.set(room.id, room);
      })),
      this.client.on("roomRemoved", data => update(() => { this.byId.delete(data.roomId); })),
      this.client.on("roomPlayersChanged", data => update(() => {
        const room = this.byId.get(data.state.roomId);
        if(room && data.state.playersInRoom !== undefined) this.byId.set(room.id, { ...room, playersNum: data.state.playersInRoom });
      })),
      this.client.on("roomStatusChanged", data => update(() => {
        const room = this.byId.get(data.roomId);
        if(room) this.byId.set(room.id, { ...room, status: data.status });
      }))
    );
    this.client.send("addClientToRoomsList");
  }

  /** заново запросить список (кнопка «Обновить», переподключение) */
  refresh() {
    this.client.send("addClientToRoomsList");
  }

  async join(roomId: string, password = ""): Promise<JoinResult> {
    const reply = await this.client.request("enterRoom", { password: password ? md5salt(password) : "", roomId }, ENTER_REPLIES, { timeout: 8000 });
    return toJoinResult(reply);
  }

  async create(room: { title: string, minPlayers: number, maxPlayers: number, minLevel: number, selectedRoles: number[], password: string, vip: boolean }): Promise<JoinResult> {
    const reply = await this.client.request("createRoom", {
      room: { ...room, daytime: 0, password: room.password ? md5salt(room.password) : "" }
    }, ENTER_REPLIES, { timeout: 8000 });
    return toJoinResult(reply);
  }

  /** игроки в комнате, не заходя в неё */
  async players(roomId: string) {
    const answer = await this.client.request("getPlayersInRoom", { roomId }, "playersInRoom");
    return answer.data.players;
  }

  /**
   * ждёт, пока в комнате останется одно свободное место, и сообщает, как закончилось
   * `onUpdate` получает текущее число игроков
   */
  waitForSlot(room: RoomItem, onUpdate: (players: number) => void): { done: Promise<"slot" | "started" | "cancelled">, cancel(): void } {
    let finish!: (result: "slot" | "started" | "cancelled") => void;
    const done = new Promise<"slot" | "started" | "cancelled">(resolve => { finish = resolve; });
    const handles: Handle[] = [
      this.client.on("roomPlayersChanged", data => {
        if(data.state.roomId != room.id || data.state.playersInRoom === undefined) return;
        onUpdate(data.state.playersInRoom);
        if(room.maxPlayers - data.state.playersInRoom == 1) finish("slot");
      }),
      this.client.on("roomStatusChanged", data => { if(data.roomId == room.id && data.status == 2) finish("started"); })
    ];
    void done.then(() => handles.forEach(handle => handle.remove()));
    return { done, cancel: () => finish("cancelled") };
  }

  close() {
    for(const handle of this.handles) handle.remove();
    this.handles = [];
  }
}
