import { describe, expect, test } from "bun:test";
import { Connection, ConnectionError, RequestTimeoutError, ServerClient } from ".";
import { createFakeNetwork, instantDelay } from "./testing";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function setup() {
  const network = createFakeNetwork();
  const connection = new Connection({ url: "ws://test", createSocket: () => network.createSocket(), delay: instantDelay });
  const client = new ServerClient(connection);
  return { network, connection, client };
}

describe("Connection", () => {
  test("после обрыва переподключается сам", async() => {
    const { network, connection } = setup();
    connection.connect();
    await tick();
    expect(connection.state).toBe("open");

    network.last.drop();
    await tick();
    expect(network.sockets).toHaveLength(2);
    expect(connection.state).toBe("open");
  });

  test("запасные адреса: не отвечает один - пробуем следующий; после успеха начинаем с сработавшего", async() => {
    const urls = ["wss://a", "wss://b", "wss://c"];
    const asked: string[] = [];
    const network = createFakeNetwork();
    network.autoAccept = false;
    const connection = new Connection({ url: urls, createSocket: url => { asked.push(url); return network.createSocket(); }, delay: instantDelay });

    connection.connect();
    network.last.drop();                      // a не ответил
    await tick();
    network.last.drop();                      // b не ответил
    await tick();
    expect(asked).toEqual(["wss://a", "wss://b", "wss://c"]);

    network.last.accept();                    // c сработал
    expect(connection.state).toBe("open");
    network.last.drop();                      // позже оборвалось: сначала снова c, а не a
    await tick();
    expect(asked.at(-1)).toBe("wss://c");
  });

  test("close() закрывает насовсем: повторных подключений нет", async() => {
    const { network, connection } = setup();
    connection.connect();
    await tick();

    connection.close();
    await tick();
    expect(network.sockets).toHaveLength(1);
    expect(connection.state).toBe("closed");
    expect(() => connection.send("{}")).toThrow(ConnectionError);
  });

  test("пауза между попытками растёт и сбрасывается после успешного подключения", async() => {
    const network = createFakeNetwork();
    const pauses: number[] = [];
    const connection = new Connection({
      url: "ws://test",
      createSocket: () => network.createSocket(),
      backoff: [10, 20, 40],
      jitter: 0,
      delay: async ms => { pauses.push(ms); }
    });
    network.autoAccept = false;
    connection.connect();
    network.last.drop();
    await tick();
    network.last.drop();
    await tick();
    expect(pauses).toEqual([10, 20]);

    network.last.accept();
    network.last.drop();
    await tick();
    expect(pauses).toEqual([10, 20, 10]);
  });
});

describe("Connection: разброс пауз", () => {
  test("пауза отклоняется от базовой не больше чем на заданную долю", async() => {
    const network = createFakeNetwork();
    const pauses: number[] = [];
    const values = [0, 1];
    const connection = new Connection({
      url: "ws://test", createSocket: () => network.createSocket(), backoff: [1000], jitter: 0.3, random: () => values.shift() ?? 0.5,
      delay: async ms => { pauses.push(ms); }
    });
    network.autoAccept = false;
    connection.connect();
    network.last.drop();
    await tick();
    network.last.drop();
    await tick();
    expect(pauses).toEqual([700, 1300]);
  });
});

describe("ServerClient", () => {
  test("request отвечает на пакет, пришедший сразу после отправки", async() => {
    const { network, client } = setup();
    client.connect();
    await tick();
    network.respond = (packet, socket) => {
      if(packet.ty == "usgdph") socket.receive({ ty: "usdph", usdph: { usdphi: ["m1", "f2"] } });
    };

    const answer = await client.request("getDefaultPhotos", {}, "defaultPhotos");
    expect(answer.data.photos.ids).toEqual(["m1", "f2"]);
  });

  test("request ждёт любой из нескольких ответов", async() => {
    const { network, client } = setup();
    client.connect();
    await tick();
    network.respond = (_, socket) => socket.receive({ ty: "wft" });

    const answer = await client.request("uploadPhoto", { file: "x" }, ["dashboard", "wrongFileType"], { timeout: 100 }).catch(e => e);
    // без сессии uploadPhoto не уйдёт
    expect(answer).toBeInstanceOf(Error);

    client.session = { userObjectId: "u", token: "t" };
    const second = await client.request("uploadPhoto", { file: "x" }, ["dashboard", "wrongFileType"]);
    expect(second.name).toBe("wrongFileType");
  });

  test("без ответа request заканчивается ошибкой, а не висит", async() => {
    const { client } = setup();
    client.connect();
    await tick();
    expect(client.request("getDefaultPhotos", {}, "defaultPhotos", { timeout: 10 })).rejects.toBeInstanceOf(RequestTimeoutError);
  });

  test("обрыв связи отменяет ожидающие запросы", async() => {
    const { network, client } = setup();
    client.connect();
    await tick();

    const pending = client.request("getDefaultPhotos", {}, "defaultPhotos");
    network.last.drop();
    expect(pending).rejects.toBeInstanceOf(ConnectionError);
  });

  test("token и userObjectId подставляются из сессии, в traffic их нет", async() => {
    const { network, client } = setup();
    client.connect();
    await tick();
    client.session = { userObjectId: "u1", token: "secret" };
    const traffic: unknown[] = [];
    client.on("traffic", t => traffic.push(t));

    client.send("removePhoto");
    expect(network.last.sent.at(-1)).toEqual({ ty: "rph", uo: "u1", t: "secret" });
    expect(JSON.stringify(traffic)).not.toContain("secret");
  });

  test("подписка по имени пакета, незнакомые и битые пакеты не ломают приём", async() => {
    const { network, client } = setup();
    client.connect();
    await tick();
    const log: string[] = [];
    client.on("timer", data => log.push(`timer ${data.seconds}`));
    client.on("unknown", message => log.push(`unknown ${message.type}`));
    client.on("malformed", () => log.push("malformed"));

    network.last.receive({ t: 7 });
    network.last.receive({ ty: "new-thing" });
    network.last.receive({ ty: "siner", e: "не число" });
    network.last.receive("не json");
    network.last.receive({ t: 8 });

    expect(log).toEqual(["timer 7", "unknown new-thing", "malformed", "malformed", "timer 8"]);
  });

  test("ошибка в обработчике не ломает приём следующих пакетов", async() => {
    const { network, client } = setup();
    client.connect();
    await tick();
    const seen: number[] = [];
    const originalError = console.error;
    console.error = () => {};
    client.on("timer", data => {
      seen.push(data.seconds);
      throw new Error("boom");
    });
    network.last.receive({ t: 1 });
    network.last.receive({ t: 2 });
    console.error = originalError;
    expect(seen).toEqual([1, 2]);
  });
});
