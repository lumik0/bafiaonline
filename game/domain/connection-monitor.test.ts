import { describe, expect, test } from "bun:test";
import type { NotificationOptions } from "@common/ui/notifications/center";
import Events from "@common/utils/emitter";
import { ConnectionMonitor } from "./connection-monitor";

function setup(inGame = true, withReconnect = false) {
  const client = Object.assign(new Events<{ open: () => void, close: (willReconnect: boolean) => void, message: () => void }>(), { connection: { state: "open" } });
  const shown: NotificationOptions[] = [];
  const dismissed: string[] = [];
  const network = new EventTarget();
  let time = 0;
  let tick = () => {};
  const state = { inGame };
  const reconnects: number[] = [];
  const monitor = new ConnectionMonitor({
    client: client as never, network, inGame: () => state.inGame, now: () => time,
    notifier: { show: o => { shown.push(o); }, dismiss: key => { dismissed.push(key); } },
    schedule: callback => { tick = callback; return 1; }, cancel: () => {},
    reconnect: withReconnect ? () => { reconnects.push(time); } : undefined
  });
  monitor.start();
  return {
    client, shown, dismissed, network, monitor, state, reconnects,
    advance: (ms: number) => { time += ms; tick(); },
    last: () => shown.at(-1)!
  };
}

describe("уведомления о связи", () => {
  test("до первого соединения молчит (это дело экрана загрузки); после обрыва: попытки считаются, восстановление сообщается", () => {
    const { client, shown, last } = setup();
    client.emit("close", true);
    expect(shown).toEqual([]);

    client.emit("open");
    client.emit("close", true);
    expect(last()).toMatchObject({ key: "connection", kind: "warning", title: "Нет связи с сервером", timeout: 0 });
    expect(last().text).toContain("попытка 1");

    client.emit("close", true);
    expect(last().text).toContain("попытка 2");

    client.emit("open");
    expect(last()).toMatchObject({ key: "connection", kind: "success", title: "Связь восстановлена", timeout: 3000 });
    client.emit("close", true);
    expect(last().text).toContain("попытка 1");     // счёт начался заново
  });

  test("закрытие без переподключения (окно игры закрыто) ничего не показывает", () => {
    const { client, shown } = setup();
    client.emit("open");
    client.emit("close", false);
    expect(shown).toEqual([]);
  });

  test("в игре тишина дольше 8 секунд - предупреждение; пришёл пакет - «восстановлена»; вне игры тишина нормальна", () => {
    const { client, shown, advance, last, state } = setup();
    client.emit("open");

    advance(5000);
    expect(shown).toEqual([]);
    client.emit("message");
    advance(7000);
    expect(shown).toEqual([]);

    advance(2000);
    expect(last()).toMatchObject({ kind: "warning", title: "Нет данных от сервера", timeout: 0 });
    const count = shown.length;
    advance(5000);
    expect(shown).toHaveLength(count);               // одно и то же не повторяется

    client.emit("message");
    expect(last()).toMatchObject({ kind: "success", title: "Связь восстановлена" });

    state.inGame = false;
    advance(60_000);
    expect(shown).toHaveLength(count + 1);
  });

  test("интернет пропал и появился", () => {
    const { network, last } = setup();
    network.dispatchEvent(new Event("offline"));
    expect(last()).toMatchObject({ kind: "error", title: "Нет интернета", timeout: 0 });
    network.dispatchEvent(new Event("online"));
    expect(last()).toMatchObject({ kind: "info", title: "Интернет появился" });
  });

  test("stop убирает уведомление и подписки", () => {
    const { client, shown, dismissed, monitor } = setup();
    client.emit("open");
    monitor.stop();
    expect(dismissed).toEqual(["connection"]);
    client.emit("close", true);
    expect(shown).toEqual([]);
  });

  test("тишина в игре: сразу переподключается, при молчании и дальше пробует реже (16, 32, 60 секунд), а пакет сбрасывает счёт", () => {
    const { client, advance, reconnects, shown, last } = setup(true, true);
    client.emit("open");

    advance(8000);
    expect(reconnects).toEqual([8000]);
    expect(last()).toMatchObject({ title: "Нет данных от сервера" });
    expect(last().text).toContain("Переподключаюсь");

    advance(14_000);                                  // 14 секунд после первой попытки: рано (пауза 16)
    expect(reconnects).toHaveLength(1);
    advance(2000);
    expect(reconnects).toEqual([8000, 24000]);
    advance(30_000);                                  // пауза 32: ещё рано
    expect(reconnects).toHaveLength(2);
    advance(2000);
    expect(reconnects).toEqual([8000, 24000, 56000]);
    advance(58_000);                                  // дальше потолок 60 секунд
    expect(reconnects).toHaveLength(3);
    advance(2000);
    expect(reconnects).toEqual([8000, 24000, 56000, 116000]);

    // пошли пакеты: счёт паузы начинается заново, а уведомление уходит
    client.emit("message");
    expect(last()).toMatchObject({ title: "Связь восстановлена" });
    const before = reconnects.length;
    advance(8000);
    expect(reconnects).toHaveLength(before + 1);
    expect(shown.length).toBeGreaterThan(2);
  });

  test("переподключение само не вызывается: вне игры, пока сокет закрыт (оно и так идёт), и если дело в обрыве", () => {
    const { client, advance, reconnects, state } = setup(false, true);
    client.emit("open");
    advance(60_000);                                  // вне игры тишина нормальна
    expect(reconnects).toEqual([]);

    state.inGame = true;
    client.emit("close", true);                       // сокет закрылся сам: переподключение уже идёт
    advance(60_000);
    expect(reconnects).toEqual([]);

    client.emit("open");
    advance(8000);
    expect(reconnects).toHaveLength(1);
  });
});

