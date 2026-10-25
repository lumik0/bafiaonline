import type { SocketLike } from "./connection";

/** сокет для тестов: сервер - это сам тест */
export class FakeSocket implements SocketLike {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;

  /** что клиент отправил, уже разобранный JSON */
  sent: Record<string, any>[] = [];
  closed = false;
  /** автоответ сервера на каждый отправленный пакет */
  respond?: (packet: Record<string, any>, socket: FakeSocket) => void;

  send(data: string) {
    const packet = JSON.parse(data);
    this.sent.push(packet);
    // ответ приходит позже, как по сети
    queueMicrotask(() => this.respond?.(packet, this));
  }

  close() {
    this.closed = true;
    this.onclose?.();
  }

  /** сервер открыл соединение */
  accept() { this.onopen?.(); }
  /** сервер прислал пакет (объект или готовая строка) */
  receive(packet: object | string) { this.onmessage?.({ data: typeof packet == "string" ? packet : JSON.stringify(packet) }); }
  /** обрыв связи */
  drop() { this.onclose?.(); }
}

export function createFakeNetwork() {
  const sockets: FakeSocket[] = [];
  return {
    sockets,
    get last() { return sockets.at(-1)!; },
    /** применяется ко всем новым сокетам: так сервер отвечает и после переподключения */
    respond: undefined as FakeSocket["respond"],
    autoAccept: true,
    createSocket(): FakeSocket {
      const socket = new FakeSocket();
      socket.respond = (packet, s) => this.respond?.(packet, s);
      sockets.push(socket);
      if(this.autoAccept) queueMicrotask(() => socket.accept());
      return socket;
    }
  };
}

export const instantDelay = () => Promise.resolve();
