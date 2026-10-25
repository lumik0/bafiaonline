import { decode, encode, ProtocolError, type ClientInput, type ClientPacketName, type ServerData, type ServerMessage, type ServerPacketName, type Session } from "../protocol";
import Events from "../utils/emitter";
import { Connection, ConnectionError } from "./connection";

export class RequestTimeoutError extends Error {
  constructor(expected: string) {
    super(`Сервер не ответил (ждали ${expected})`);
    this.name = "RequestTimeoutError";
  }
}

export interface Traffic {
  direction: "in" | "out"
  name: string
  /** без токенов и паролей */
  data: unknown
}

type PacketEvents = { [N in ServerPacketName]: (data: ServerData<N>) => void };

export type ClientEvents = PacketEvents & {
  /** пакет, схемы которого ещё нет в протоколе */
  unknown: (message: Extract<ServerMessage, { name: "unknown" }>) => void
  /** любой разобранный пакет */
  message: (message: ServerMessage) => void
  /** пакет известного типа не подошёл к схеме */
  malformed: (text: string, error: unknown) => void
  traffic: (traffic: Traffic) => void
  open: () => void
  close: (willReconnect: boolean) => void
};

const SECRET_FIELDS = new Set(["token", "password"]);

function redact(value: unknown): unknown {
  if(Array.isArray(value)) return value.map(redact);
  if(typeof value != "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SECRET_FIELDS.has(key) ? "***" : redact(item)]));
}

interface Waiter {
  names: ServerPacketName[]
  resolve(message: ServerMessage): void
  reject(error: Error): void
}

export class ServerClient extends Events<ClientEvents> {
  /** нужна пакетам с авторизацией; выставляет вход в аккаунт */
  session?: Session;

  private waiters = new Set<Waiter>();

  constructor(readonly connection: Connection) {
    super();

    connection.on("open", () => this.emit("open"));
    connection.on("close", willReconnect => {
      this.rejectWaiters(new ConnectionError("Соединение потеряно"));
      this.emit("close", willReconnect);
    });
    connection.on("message", text => this.receive(text));
  }

  connect() { this.connection.connect(); }
  close() { this.connection.close(); }

  send<N extends ClientPacketName>(name: N, ...[input]: {} extends ClientInput<N> ? [input?: ClientInput<N>] : [input: ClientInput<N>]) {
    const data = (input ?? {}) as ClientInput<N>;
    this.connection.send(encode(name, data, this.session));
    this.emit("traffic", { direction: "out", name, data: redact(data) });
  }

  /**
   * отправляет пакет и ждёт один из ответов
   * ждём до отправки, чтобы быстрый ответ не потерялся; обрыв и таймаут - ошибка
   */
  request<N extends ClientPacketName, R extends ServerPacketName>(
    name: N,
    input: ClientInput<N>,
    expect: R | readonly R[],
    { timeout = 10_000 }: { timeout?: number } = {}
  ): Promise<Extract<ServerMessage, { name: R }>> {
    const names = (Array.isArray(expect) ? expect : [expect]) as R[];

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => settle(() => reject(new RequestTimeoutError(names.join(" / ")))), timeout);
      const waiter: Waiter = {
        names,
        resolve: message => settle(() => resolve(message as Extract<ServerMessage, { name: R }>)),
        reject: error => settle(() => reject(error))
      };
      const settle = (finish: () => void) => {
        clearTimeout(timer);
        this.waiters.delete(waiter);
        finish();
      };

      this.waiters.add(waiter);
      try {
        (this.send as (name: string, input: unknown) => void)(name, input);
      } catch(error) {
        waiter.reject(error as Error);
      }
    });
  }

  private receive(text: string) {
    let message: ServerMessage;
    try {
      message = decode(text);
    } catch(error) {
      if(!(error instanceof ProtocolError) && !(error instanceof SyntaxError)) throw error;
      this.emit("malformed", text, error);
      return;
    }

    if(message.name != "timer") this.emit("traffic", { direction: "in", name: message.name, data: redact(message.data) });

    for(const waiter of [...this.waiters]) {
      if(message.name != "unknown" && waiter.names.includes(message.name)) waiter.resolve(message);
    }

    // ошибка в обработчике экрана не должна ломать приём следующих пакетов
    try {
      this.emit("message", message);
      if(message.name == "unknown") this.emit("unknown", message);
      else (this.emit as (event: string, data: unknown) => void)(message.name, message.data);
    } catch(error) {
      console.error(`Ошибка в обработчике пакета "${message.name}"`, error);
    }
  }

  private rejectWaiters(error: Error) {
    for(const waiter of [...this.waiters]) waiter.reject(error);
  }
}
