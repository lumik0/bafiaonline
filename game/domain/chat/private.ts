import type { ServerClient } from "@common/net";
import type { ServerData } from "@common/protocol";
import Events from "@common/utils/emitter";
import type { SettingsStore } from "../settings";
import { applyBarmanEffect, type ChatEntry, type ChatUser } from "./message";

type Raw = ServerData<"privateChatMessage">["message"];
type Handle = { remove(): void };

export interface PrivateMessage {
  id: number
  /** номер сообщения на сервере: по нему сообщение удаляется у обоих */
  objectId?: string
  /** playerObjectId отправителя */
  from: string
  text: string
  created?: number
  /** собеседник прочитал */
  read: boolean
}

let nextId = 1;
const toMessage = (raw: Raw): PrivateMessage => ({ id: nextId++, objectId: raw.id, from: raw.playerObjectId ?? "", text: raw.text ?? "", created: raw.created, read: !!raw.accepted });

const MAX = 150;
/** сколько удалённых у себя сообщений помним по каждой переписке */
export const HIDDEN_MAX = 500;

/**
 * стабильный ключ сообщения: номер `id` меняется при каждой загрузке переписки, а время, автор и текст остаются теми же,
 * поэтому по ним удалённое у себя сообщение узнаётся и после перезахода
 */
export function messageKey(message: Pick<PrivateMessage, "from" | "text" | "created">): string {
  let hash = 5381;
  for(let i = 0; i < message.text.length; i++) hash = (hash * 33 ^ message.text.charCodeAt(i)) >>> 0;
  return `${message.created ?? 0}|${message.from}|${message.text.length}|${hash.toString(36)}`;
}

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
      // кто-то из двоих удалил сообщение: оно пропадает у обоих
      this.client.on("privateMessageRemoved", data => {
        if(!this.messages.some(message => message.objectId == data.messageId)) return;
        this.messages = this.messages.filter(message => message.objectId != data.messageId);
        this.emit("change");
      }),
      this.client.on("privateTypingStarted", () => { this.typing = true; this.emit("change"); }),
      this.client.on("privateTypingStopped", () => { this.typing = false; this.emit("change"); })
    );
    this.client.send("openPrivateChat", { friendshipId: this.friendshipId });
  }

  /**
   * удалить своё сообщение у обоих: уходит запрос серверу, а сообщение пропадает, когда он подтвердит событием (так же и у собеседника).
   * Возвращает, ушёл ли запрос (у сообщения нет номера на сервере - не уходит)
   */
  remove(id: number): boolean {
    const message = this.messages.find(item => item.id == id);
    if(!message?.objectId) return false;
    this.client.send("removePrivateMessage", { friendshipId: this.friendshipId, messageId: message.objectId });
    return true;
  }

  /** сообщения без удалённых у себя */
  get visible(): PrivateMessage[] {
    const hidden = new Set(this.settings.data.hiddenPrivate?.[this.friendshipId] ?? []);
    return hidden.size ? this.messages.filter(message => !hidden.has(messageKey(message))) : this.messages;
  }

  /**
   * удалить сообщение у себя: собеседник его по-прежнему видит (сервер игры удаления не даёт), у тебя оно пропадает насовсем,
   * в том числе после перезахода. Возвращает, нашлось ли такое сообщение
   */
  hide(id: number): boolean {
    const message = this.messages.find(item => item.id == id);
    if(!message) return false;
    const key = messageKey(message);
    this.settings.update(data => {
      const all = (data.hiddenPrivate ??= {});
      const list = all[this.friendshipId] ?? [];
      if(!list.includes(key)) all[this.friendshipId] = [...list, key].slice(-HIDDEN_MAX);
    });
    this.emit("change");
    return true;
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
