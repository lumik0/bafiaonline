import { describe, expect, test } from "bun:test";
import { ForegroundWatch } from "./foreground";

function setup(busy = false) {
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const win = new EventTarget();
  let time = 0;
  const state = { busy };
  const reconnects: number[] = [];
  const watch = new ForegroundWatch({ document: doc, window: win, busy: () => state.busy, reconnect: () => reconnects.push(time), now: () => time });
  watch.start();
  const hide = () => { doc.visibilityState = "hidden"; doc.dispatchEvent(new Event("visibilitychange")); };
  const show = () => { doc.visibilityState = "visible"; doc.dispatchEvent(new Event("visibilitychange")); };
  return { watch, state, reconnects, hide, show, win, advance: (ms: number) => { time += ms; } };
}

describe("возвращение на вкладку", () => {
  test("долгий фон - соединение открывается заново, короткий - нет", () => {
    const { reconnects, hide, show, advance } = setup();
    hide(); advance(5000); show();
    expect(reconnects).toEqual([]);

    hide(); advance(20_000); show();
    expect(reconnects).toHaveLength(1);

    show(); show();                                   // повторные «видна» без ухода в фон ничего не делают
    expect(reconnects).toHaveLength(1);
  });

  test("в игре не трогаем: тишину заметит монитор связи; а после игры работает как обычно", () => {
    const { reconnects, hide, show, advance, state } = setup(true);
    hide(); advance(60_000); show();
    expect(reconnects).toEqual([]);

    state.busy = false;
    hide(); advance(60_000); show();
    expect(reconnects).toHaveLength(1);
  });

  test("страница вернулась из памяти браузера (pageshow persisted) - считаем, что была в фоне долго; обычный pageshow ничего не делает", () => {
    const { reconnects, win } = setup();
    win.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: false }));
    expect(reconnects).toEqual([]);
    win.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    expect(reconnects).toHaveLength(1);
  });

  test("stop снимает подписки, повторный start не подписывает дважды", () => {
    const { watch, reconnects, hide, show, advance } = setup();
    watch.start();
    hide(); advance(30_000); show();
    expect(reconnects).toHaveLength(1);                // не два

    watch.stop();
    hide(); advance(30_000); show();
    expect(reconnects).toHaveLength(1);
  });
});
