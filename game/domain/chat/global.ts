import type { ServerClient } from "@common/net";
import Events from "@common/utils/emitter";
import type { SettingsStore } from "../settings";
import { applyBarmanEffect, MessageList, toChatUser, toEntry, type ChatEntry, type ChatUser } from "./message";

type Handle = { remove(): void };

/** общий чат: список сообщений, игроки в чате и отправка. Подписки снимаются в `close()` вместе с экраном */
export class GlobalChat extends Events<{ change: () => void }> {
  private list = new MessageList();
  users: ChatUser[] = [];
  private handles: Handle[] = [];

  constructor(private client: ServerClient, private settings: SettingsStore) {
    super();
  }

  get entries(): readonly ChatEntry[] { return this.list.entries; }

  open() {
    this.handles.push(
      this.client.on("chatMessages", data => { this.list.replace(data.messages.map(toEntry)); this.emit("change"); }),
      this.client.on("chatMessage", data => { this.list.add(toEntry(data.message)); this.emit("change"); }),
      this.client.on("chatUsers", data => { this.users = data.users.map(toChatUser); this.emit("change"); })
    );
    this.client.send("addClientToChat");
  }

  send(text: string, options: { style?: number, sticker?: boolean } = {}) {
    const message = applyBarmanEffect(text, this.settings.data.game.barmanEffect);
    if(!message.trim()) return;
    this.client.send("sendChatMessage", { message: { text: message, style: options.style ?? 0, sticker: options.sticker ?? false } });
  }

  close() {
    for(const handle of this.handles) handle.remove();
    this.handles = [];
  }
}
