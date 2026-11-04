import { describe, expect, test } from "bun:test";
import { buildToken, UpdateWatch } from "./update";

const page = (token: string) => `<html><body><div id="root"></div><script src="./play/bin/index.js?v=${token}"></script></body></html>`;

function setup(current: string | null = "aaa") {
  let time = 0;
  let body = page("aaa");
  let failing = false;
  const found: string[] = [];
  const timers: { callback: () => void, ms: number, cancelled: boolean }[] = [];
  const watch = new UpdateWatch({
    current: current ?? undefined,
    fetchPage: async() => { if(failing) throw new Error("offline"); return body; },
    onAvailable: token => found.push(token),
    now: () => time,
    schedule: (callback, ms) => { const timer = { callback, ms, cancelled: false }; timers.push(timer); return timer; },
    cancel: handle => { (handle as { cancelled: boolean }).cancelled = true; }
  });
  return { watch, found, timers, publish: (token: string) => { body = page(token); }, offline: (value: boolean) => { failing = value; }, advance: (ms: number) => { time += ms; } };
}

describe("метка сборки страницы", () => {
  test("берётся из адреса скрипта игры; нет скрипта - нет метки", () => {
    expect(buildToken(page("mw1ytmva"))).toBe("mw1ytmva");
    expect(buildToken("<html><script src='./other.js'></script></html>")).toBeUndefined();
    expect(buildToken("")).toBeUndefined();
  });
});

describe("проверка обновления", () => {
  test("та же метка - тихо; новая - сообщаем один раз, даже если проверок несколько", async() => {
    const { watch, found, publish } = setup();
    await watch.check();
    expect(found).toEqual([]);
    expect(watch.available).toBeUndefined();

    publish("bbb");
    await watch.check();
    await watch.check();
    expect(found).toEqual(["bbb"]);
    expect(watch.available).toBe("bbb");

    publish("ccc");                                      // вышла ещё одна: о ней тоже сообщаем
    await watch.check();
    expect(found).toEqual(["bbb", "ccc"]);
  });

  test("нет сети или сайт отдал мусор: молча, а когда сеть вернулась - всё работает", async() => {
    const { watch, found, publish, offline } = setup();
    publish("bbb");
    offline(true);
    await watch.check();
    expect(found).toEqual([]);

    offline(false);
    await watch.check();
    expect(found).toEqual(["bbb"]);

    const garbage = setup();
    garbage.publish("");
    await garbage.watch.check();
    expect(garbage.found).toEqual([]);
  });

  test("запущено не с сайта (нет своей метки): проверка выключена и таймеры не заводятся", async() => {
    const { watch, found, timers } = setup(null);
    watch.start();
    await watch.check();
    expect(timers).toHaveLength(0);
    expect(found).toEqual([]);
  });

  test("первая проверка через 30 секунд, потом раз в 10 минут; stop всё отменяет", async() => {
    const { watch, found, timers, publish } = setup();
    watch.start();
    watch.start();                                       // повторный запуск ничего не удваивает
    expect(timers.map(timer => timer.ms)).toEqual([30_000, 600_000]);

    publish("bbb");
    timers[0]!.callback();                               // первая проверка
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(found).toEqual(["bbb"]);

    timers[1]!.callback();                               // период: проверка и следующий круг
    expect(timers.map(timer => timer.ms)).toEqual([30_000, 600_000, 600_000]);

    watch.stop();
    expect(timers[0]!.cancelled).toBe(true);             // первая проверка
    expect(timers.at(-1)!.cancelled).toBe(true);         // следующий круг
  });

  test("возврат на вкладку: если давно не проверяли - проверяем сразу, иначе нет", async() => {
    const { watch, found, publish, advance } = setup();
    publish("bbb");
    await watch.check();                                 // только что проверили, о новой версии сообщили
    expect(found).toEqual(["bbb"]);

    publish("ccc");
    advance(60_000);
    watch.visible();                                     // прошла минута: рано
    await Promise.resolve(); await Promise.resolve();
    expect(found).toEqual(["bbb"]);

    advance(61_000);
    watch.visible();                                     // больше двух минут
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(found).toEqual(["bbb", "ccc"]);
  });
});
