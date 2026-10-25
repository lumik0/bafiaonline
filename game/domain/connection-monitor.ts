import type { ServerClient } from "@common/net";
import type { Notifier } from "@common/ui/notifications/center";

export interface MonitorDeps {
  client: Pick<ServerClient, "on"> & { connection: { state: string } }
  notifier: Notifier
  /** идёт ли игра в комнате: тогда сервер шлёт таймер каждую секунду, и тишина значит обрыв */
  inGame: () => boolean
  /** сеть устройства: события `online`/`offline` и `navigator.onLine` */
  network?: EventTarget
  now?: () => number
  /** через сколько мс тишины в игре считаем, что связи нет, хотя сокет ещё «открыт» */
  staleAfter?: number
  schedule?: (callback: () => void, ms: number) => unknown
  cancel?: (handle: unknown) => void
}

const KEY = "connection";

/**
 * следит за связью и сообщает игроку: обрыв, нет интернета, сервер долго молчит
 * (таймер в игре стоит, и непонятно, что происходит). Когда связь вернулась - уведомление «восстановлено»
 * это часть самой игры, а не мод
 */
export class ConnectionMonitor {
  private wasOpen = false;
  private down = false;
  private stale = false;
  private attempts = 0;
  private lastMessage: number;
  private handles: { remove(): void }[] = [];
  private timer?: unknown;
  private cleanup: (() => void)[] = [];

  constructor(private deps: MonitorDeps) {
    this.lastMessage = this.now();
  }

  private now() { return (this.deps.now ?? Date.now)(); }

  start() {
    const { client, notifier, network } = this.deps;

    this.handles.push(
      client.on("open", () => {
        this.wasOpen = true;
        this.attempts = 0;
        this.lastMessage = this.now();
        if(this.down || this.stale) this.recovered();
      }),
      client.on("close", willReconnect => {
        // пока игра ещё ни разу не соединилась, об этом говорит экран загрузки
        if(!this.wasOpen || !willReconnect) return;
        this.attempts++;
        this.down = true;
        this.stale = false;
        notifier.show({
          key: KEY, kind: "warning", timeout: 0, title: "Нет связи с сервером",
          text: `Соединение прервалось, переподключаюсь… (попытка ${this.attempts}). Если ты в игре, таймер может стоять.`
        });
      }),
      client.on("message", () => {
        this.lastMessage = this.now();
        if(this.stale) this.recovered();
      })
    );

    if(network) {
      const offline = () => {
        this.down = true;
        notifier.show({ key: KEY, kind: "error", timeout: 0, title: "Нет интернета", text: "Проверь подключение. Игра подключится сама, как только сеть появится." });
      };
      const online = () => notifier.show({ key: KEY, kind: "info", timeout: 3000, title: "Интернет появился", text: "Подключаюсь к серверу…" });
      network.addEventListener("offline", offline);
      network.addEventListener("online", online);
      this.cleanup.push(() => network.removeEventListener("offline", offline), () => network.removeEventListener("online", online));
    }

    this.timer = (this.deps.schedule ?? setInterval)(() => this.check(), 2000);
  }

  private recovered() {
    this.down = false;
    this.stale = false;
    this.deps.notifier.show({ key: KEY, kind: "success", timeout: 3000, title: "Связь восстановлена" });
  }

  /** сокет открыт, игра идёт, а данных нет дольше обычного */
  private check() {
    const { client, notifier, inGame, staleAfter = 8000 } = this.deps;
    if(this.stale || this.down || client.connection.state != "open" || !inGame()) return;
    if(this.now() - this.lastMessage < staleAfter) return;
    this.stale = true;
    notifier.show({
      key: KEY, kind: "warning", timeout: 0, title: "Нет данных от сервера",
      text: "Таймер мог остановиться: возможно, пропал интернет. Ждём ответа…"
    });
  }

  stop() {
    for(const handle of this.handles) handle.remove();
    this.handles = [];
    for(const undo of this.cleanup) undo();
    this.cleanup = [];
    if(this.timer !== undefined) (this.deps.cancel ?? (handle => clearInterval(handle as ReturnType<typeof setInterval>)))(this.timer);
    this.timer = undefined;
    this.deps.notifier.dismiss(KEY);
  }
}
