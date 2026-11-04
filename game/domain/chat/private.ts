import type { ServerClient } from "@common/net";
import type { ServerData } from "@common/protocol";
import Events from "@common/utils/emitter";
import type { SettingsStore } from "../settings";
import { applyBarmanEffect, type ChatEntry, type ChatUser } from "./message";

type Raw = ServerData<"privateChatMessage">["message"];
type Handle = { remove(): void };

export interface PrivateMessage {
  id: number
  /** playerObjectId отправителя */
  from: string
  text: string
  created?: number
  /** собеседник прочитал */
  read: boolean
}

let nextId = 1;
const toMessage = (raw: Raw): PrivateMessage => ({ id: nextId++, from: raw.playerObjectId ?? "", text: raw.text ?? "", created: raw.created, read: !!raw.accepted });

const MAX = 150;

/**
 * сообщения переписки в виде строк чата. Строка для сообщения создаётся один раз и остаётся тем же объектом, пока не изменилась
 * (меняется только «прочитано»): иначе на каждое событие, даже «печатает…», список перерисовывался бы целиком,
 * а это сбрасывает прокрутку и обрывает свайп на телефоне. Возвращает строки и новый кэш для следующего вызова
 */
export function toEntries(messages: readonly PrivateMessage[], known: ReadonlyMap<number, ChatEntry>, me: ChatUser, peer: ChatUser): { list: ChatEntry[], known: Map<number, ChatEntry> } {
  const next = new Map<number, ChatEntry>();
  const list = messages.map(message => {
    const mine = message.from == me.playerObjectId;
    const unread = mine && !message.read;
    const old = known.get(message.id);
    if(old && old.unread === unread) { next.set(message.id, old); return old; }
    const entry: ChatEntry = { id: message.id, kind: "message", text: message.text, created: message.created, unread, user: mine ? me : peer };
    next.set(message.id, entry);
    return entry;
  });
  return { list, known: next };
}

/** личная переписка с другом */
export class PrivateChat extends Events<{ change: () => void }> {
  messages: PrivateMessage[] = [];
  typing = false;
  loaded = false;
  private handles: Handle[] = [];

  constructor(private client: ServerClient, private settings: SettingsStore, readonly friendshipId: string) {
    super();
  }

  open() {
    this.handles.push(
      this.client.on("privateChatMessages", data => {
        this.messages = data.messages.map(toMessage).slice(-MAX);
        this.loaded = true;
        this.emit("change");
        // открыли переписку - всё полученное считается прочитанным
        this.client.send("acceptPrivateMessages", { friendshipId: this.friendshipId });
      }),
      this.client.on("privateChatMessage", data => {
        this.messages = [...this.messages, toMessage(data.message)].slice(-MAX);
        this.emit("change");
      }),
      this.client.on("privateTypingStarted", () => { this.typing = true; this.emit("change"); }),
      this.client.on("privateTypingStopped", () => { this.typing = false; this.emit("change"); })
    );
    this.client.send("openPrivateChat", { friendshipId: this.friendshipId });
  }

  /** связь переоткрылась: подписка на переписку пропала (вход в аккаунт переключил её), открываем заново, сервер пришлёт сообщения целиком */
  resubscribe() {
    if(this.handles.length) this.client.send("openPrivateChat", { friendshipId: this.friendshipId });
  }

  send(text: string) {
    const message = applyBarmanEffect(text, this.settings.data.game.barmanEffect);
    if(!message.trim()) return;
    this.client.send("sendPrivateMessage", { friendshipId: this.friendshipId, message: { text: message, style: 3, sticker: false } });
  }

  close() {
    for(const handle of this.handles) handle.remove();
    this.handles = [];
  }
}
