import Events from "../utils/emitter";

/** то, что нужно от WebSocket; тесты подменяют его своим */
export interface SocketLike {
  onopen: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onclose: (() => void) | null
  onerror: ((error: unknown) => void) | null
  send(data: string): void
  close(): void
}

export type ConnectionState = "idle" | "connecting" | "open" | "closed";

export interface ConnectionOptions {
  /** адрес, функция или список запасных: после успеха начинаем с того, что сработал */
  url: string | string[] | (() => string)
  createSocket?: (url: string) => SocketLike
  /** пауза перед очередной попыткой, мс; последнее значение повторяется */
  backoff?: number[]
  delay?: (ms: number) => Promise<void>
  /** разброс паузы, доля от неё (0.3 - ±30 %); 0 - без разброса */
  jitter?: number
  random?: () => number
}

export type ConnectionEvents = {
  open: () => void
  message: (text: string) => void
  /** willReconnect - соединение вернётся само */
  close: (willReconnect: boolean) => void
  error: (error: unknown) => void
};

export class ConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectionError";
  }
}

export class Connection extends Events<ConnectionEvents> {
  state: ConnectionState = "idle";

  private socket?: SocketLike;
  private attempt = 0;
  /** какой из адресов списка сработал в последний раз и какой пробуем сейчас */
  private preferred = 0;
  private current = 0;
  /** сколько попыток подряд так и не открылись: по ним выбирается адрес из списка */
  private failed = 0;
  private stopped = false;

  private readonly createSocket: (url: string) => SocketLike;
  private readonly backoff: number[];
  private readonly delay: (ms: number) => Promise<void>;

  constructor(private options: ConnectionOptions) {
    super();
    this.createSocket = options.createSocket ?? (url => new WebSocket(url) as unknown as SocketLike);
    this.backoff = options.backoff ?? [500, 1000, 2000, 5000, 10000];
    this.delay = options.delay ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  }

  connect() {
    if(this.state == "connecting" || this.state == "open") return;
    this.stopped = false;
    this.open();
  }

  send(text: string) {
    if(this.state != "open" || !this.socket) throw new ConnectionError("Нет соединения с сервером");
    this.socket.send(text);
  }

  /** закрывает соединение и больше не переподключается */
  close() {
    this.stopped = true;
    const socket = this.socket;
    this.socket = undefined;
    const wasActive = this.state == "open" || this.state == "connecting";
    this.state = "closed";
    if(socket) {
      detach(socket);
      socket.close();
    }
    if(wasActive) this.emit("close", false);
  }

  private open() {
    const url = this.pickUrl();
    const socket = this.createSocket(url);
    this.socket = socket;
    this.state = "connecting";

    socket.onopen = () => {
      this.attempt = 0;
      this.failed = 0;
      this.preferred = this.current;
      this.state = "open";
      this.emit("open");
    };
    socket.onmessage = event => {
      if(typeof event.data == "string") this.emit("message", event.data);
    };
    socket.onerror = error => this.emit("error", error);
    socket.onclose = () => {
      if(this.socket !== socket) return;
      detach(socket);
      if(this.state == "connecting") this.failed++;
      this.socket = undefined;
      this.state = "closed";
      this.emit("close", !this.stopped);
      if(!this.stopped) void this.reconnect();
    };
  }

  private pickUrl(): string {
    const { url } = this.options;
    if(typeof url == "string") return url;
    if(typeof url == "function") return url();
    this.current = (this.preferred + this.failed) % url.length;
    return url[this.current]!;
  }

  private async reconnect() {
    const base = this.backoff[Math.min(this.attempt++, this.backoff.length - 1)] ?? 1000;
    const spread = this.options.jitter ?? 0.3;
    const pause = Math.round(base * (1 + spread * (2 * (this.options.random ?? Math.random)() - 1)));
    await this.delay(pause);
    if(!this.stopped && this.state == "closed") this.open();
  }
}

function detach(socket: SocketLike) {
  socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
}
