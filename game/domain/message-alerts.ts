import type { ServerClient } from "@common/net";
import type { Notifier } from "@common/ui/notifications/center";
import { Friends } from "./friends";
import type { User } from "./user";

export interface MessageAlertsDeps {
  client: ServerClient
  user: User
  notifier: Notifier
  /** открыт ли сейчас личный чат: в нём сообщения и так видны, баннер не нужен */
  chatOpen: () => boolean
  /** как часто спрашивать о новом, мс (30 секунд); 0 - только слушать */
  intervalMs?: number
  /**
   * можно ли спросить дашборд: `addClientToDashboard` переключит подписку и остановит игру
   * спрашивать можно только в меню, где дашборд и так активен
   */
  canPoll: () => boolean
  /** опыт: спрашивать заявки в друзья вне меню (`getSentFriendRequests`, не переключает подписку) */
  requestsOutsideMenu?: () => boolean
}

/**
 * уведомления о личных сообщениях и заявках; сервер сам не присылает их (в приложении - push)
 * пока открыто меню, раз в 30 секунд спрашивает дашборд и по росту показывает баннер
 * в комнате и чатах спрашивать нельзя (`canPoll`): запрос остановит игру
 * дашборд заодно обновляет значки в меню; если пришло личное сообщение,
 * баннер появится сразу
 */
export class MessageAlerts {
  private messages?: number;
  private requests?: number;
  private handles: { remove(): void }[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private polling = false;

  constructor(private deps: MessageAlertsDeps) {}

  start() {
    const { client, user, intervalMs = 30_000 } = this.deps;
    this.handles = [
      client.on("dashboard", data => {
        // дашборд: обновляем игрока и смотрим, выросли ли счётчики
        if(user.isSignedIn) user.applyDashboard(data.dashboard);
        this.counters(data.dashboard.newMessages ?? 0, data.dashboard.friendshipRequests ?? 0);
      }),
      client.on("privateChatMessage", ({ message }) => this.incoming(message.playerObjectId, message.text))
    ];
    if(intervalMs > 0) this.timer = setInterval(() => void this.tick(), intervalMs);
  }

  stop() {
    for(const handle of this.handles) handle.remove();
    this.handles = [];
    clearInterval(this.timer);
  }

  /** раз в интервал: в меню - дашборд (счётчики), вне меню - только если включено, входящие заявки */
  private async tick() {
    if(this.deps.canPoll()) await this.poll();
    else if(this.deps.requestsOutsideMenu?.()) await this.pollRequests();
  }

  private seenRequests?: Set<string>;
  private pollingRequests = false;

  /**
   * входящие заявки без смены подписки: сообщает о новых (первый ответ запоминается)
   * опыт, по умолчанию выключено: что сервер подписку не трогает, проверено только по названию пакета
   */
  async pollRequests() {
    const { client, user, notifier } = this.deps;
    if(!user.isSignedIn || this.pollingRequests) return;
    this.pollingRequests = true;
    try {
      const incoming = (await new Friends(client).requests()).filter(item => item.incoming);
      const known = this.seenRequests;
      this.seenRequests = new Set(incoming.map(item => item.playerObjectId));
      const fresh = known ? incoming.filter(item => !known.has(item.playerObjectId)) : [];
      if(fresh.length) {
        notifier.show({
          key: "friend-request", source: "Друзья", kind: "info",
          title: "Новая заявка в друзья",
          text: fresh.length == 1 ? `${fresh[0]!.username} хочет добавить тебя в друзья.` : `Новых заявок: ${fresh.length}.`
        });
      }
    } catch {
      // нет связи или сервер занят: спросим в следующий раз
    } finally {
      this.pollingRequests = false;
    }
  }

  /** спросить дашборд сейчас (по таймеру и при возврате в меню) */
  async poll() {
    const { client, user, canPoll } = this.deps;
    if(!user.isSignedIn || this.polling || !canPoll()) return;
    this.polling = true;
    try {
      await client.request("addClientToDashboard", {}, "dashboard", { timeout: 8000 });
    } catch {
      // нет связи или сервер занят: спросим в следующий раз
    } finally {
      this.polling = false;
    }
  }

  /** счётчики выросли - пришло что-то новое. Первый дашборд после входа только запоминается */
  private counters(messages: number, requests: number) {
    const { notifier, chatOpen } = this.deps;
    if(this.messages !== undefined && messages > this.messages && !chatOpen()) void this.messageBanner(messages);
    if(this.requests !== undefined && requests > this.requests) {
      notifier.show({ key: "friend-request", source: "Друзья", kind: "info", title: "Новая заявка в друзья", text: "Принять её можно в разделе «Друзья»." });
    }
    this.messages = messages;
    this.requests = requests;
  }

  /** баннер о новых сообщениях: имена из списка друзей, если получится */
  private async messageBanner(total: number) {
    const { notifier, client } = this.deps;
    let senders: { username: string, newMessages: number }[] = [];
    try {
      senders = (await new Friends(client).friends()).filter(friend => friend.newMessages > 0);
    } catch {
      // список недоступен: покажем без имён
    }
    const one = senders.length == 1 ? senders[0]! : undefined;
    notifier.show({
      key: "private-message", source: "Друзья", kind: "info",
      title: one ? one.username : "Новое личное сообщение",
      text: one ? (one.newMessages > 1 ? `Новых сообщений: ${one.newMessages}` : "Новое личное сообщение")
        : senders.length ? `От: ${senders.slice(0, 3).map(sender => sender.username).join(", ")}${senders.length > 3 ? " и других" : ""}`
        : total > 1 ? `Непрочитанных сообщений: ${total}. Они в разделе «Друзья».` : "Прочитать можно в разделе «Друзья»."
    });
  }

  /** личное сообщение при закрытом чате: показываем начало текста */
  private incoming(from: string | undefined, text: string | undefined) {
    const { notifier, chatOpen, user } = this.deps;
    if(chatOpen() || (from && from == user.playerObjectId)) return;
    const snippet = (text ?? "").replace(/\s+/g, " ").trim();
    notifier.show({ key: "private-message", source: "Друзья", kind: "info", title: "Новое личное сообщение", text: snippet.length > 90 ? snippet.slice(0, 87) + "…" : snippet || undefined });
  }
}
