import { describe, expect, test } from "bun:test";
import type { NotificationOptions } from "@common/ui/notifications/center";
import Events from "@common/utils/emitter";
import { ConnectionMonitor } from "./connection-monitor";

function setup(inGame = true) {
  const client = Object.assign(new Events<{ open: () => void, close: (willReconnect: boolean) => void, message: () => void }>(), { connection: { state: "open" } });
  const shown: NotificationOptions[] = [];
  const dismissed: string[] = [];
  const network = new EventTarget();
  let time = 0;
  let tick = () => {};
  const state = { inGame };
  const monitor = new ConnectionMonitor({
    client: client as never, network, inGame: () => state.inGame, now: () => time,
    notifier: { show: o => { shown.push(o); }, dismiss: key => { dismissed.push(key); } },
    schedule: callback => { tick = callback; return 1; }, cancel: () => {}
  });
  monitor.start();
  return {
    client, shown, dismissed, network, monitor, state,
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
});
