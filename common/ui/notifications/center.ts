import Events from "../../utils/emitter";

export type NotificationKind = "info" | "success" | "warning" | "error";

export interface NotificationOptions {
  title: string
  text?: string
  kind?: NotificationKind
  /** кто показывает: «Бафия», имя мода */
  source?: string
  /** сколько мс висит; `0` - пока не закроют или не уберут через `dismiss` (например, «нет связи») */
  timeout?: number
  /**
   * уведомления с одним ключом заменяют друг друга: «переподключаюсь… (3)» обновляет одно уведомление,
   * а не плодит новые
   */
  key?: string
}

export interface NotificationItem extends Required<Pick<NotificationOptions, "title" | "kind" | "timeout">> {
  id: number
  text: string
  source: string
  key?: string
}

/** что игра и моды видят от центра уведомлений */
export interface Notifier {
  show(options: NotificationOptions): void
  dismiss(key: string): void
}

const DEFAULT_TIMEOUT = 4500;
const MAX_VISIBLE = 5;

type Timers = { set(callback: () => void, ms: number): unknown, clear(handle: unknown): void };
const realTimers: Timers = { set: (callback, ms) => setTimeout(callback, ms), clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>) };

/** уведомления: появляются в углу, сами исчезают; общий центр на весь лаунчер */
export class NotificationCenter extends Events<{ change: () => void }> implements Notifier {
  private list: NotificationItem[] = [];
  private timers = new Map<number, unknown>();
  private nextId = 1;

  constructor(private clock: Timers = realTimers) {
    super();
  }

  /** новые снизу; не больше пяти сразу: самые старые уходят */
  get items(): readonly NotificationItem[] { return this.list; }

  show(options: NotificationOptions) {
    const item: NotificationItem = {
      id: this.nextId++,
      title: options.title.slice(0, 80),
      text: (options.text ?? "").slice(0, 300),
      kind: options.kind ?? "info",
      source: options.source ?? "Бафия",
      timeout: options.timeout ?? DEFAULT_TIMEOUT,
      key: options.key
    };

    const same = item.key ? this.list.findIndex(other => other.key == item.key) : -1;
    if(same >= 0) {
      // то же уведомление обновляется на месте
      this.stopTimer(this.list[same]!.id);
      this.list = this.list.map((other, index) => index == same ? item : other);
    } else {
      this.list = [...this.list, item];
      for(const old of this.list.slice(0, Math.max(0, this.list.length - MAX_VISIBLE))) this.dismissId(old.id, false);
    }

    if(item.timeout > 0) this.timers.set(item.id, this.clock.set(() => this.dismissId(item.id), item.timeout));
    this.emit("change");
  }

  dismiss(key: string) {
    const item = this.list.find(other => other.key == key);
    if(item) this.dismissId(item.id);
  }

  dismissId(id: number, notify = true) {
    this.stopTimer(id);
    if(!this.list.some(item => item.id == id)) return;
    this.list = this.list.filter(item => item.id != id);
    if(notify) this.emit("change");
  }

  private stopTimer(id: number) {
    const handle = this.timers.get(id);
    if(handle !== undefined) this.clock.clear(handle);
    this.timers.delete(id);
  }
}
