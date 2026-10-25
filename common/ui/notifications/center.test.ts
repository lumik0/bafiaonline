import { describe, expect, test } from "bun:test";
import { NotificationCenter } from "./center";

function setup() {
  const timers = new Map<number, { callback: () => void, ms: number }>();
  let next = 1;
  const center = new NotificationCenter({
    set: (callback, ms) => { const id = next++; timers.set(id, { callback, ms }); return id; },
    clear: handle => { timers.delete(handle as number); }
  });
  const fire = () => { for(const [id, timer] of [...timers]) { timers.delete(id); timer.callback(); } };
  return { center, timers, fire };
}

describe("уведомления", () => {
  test("показываются, сами исчезают по таймеру, убираются нажатием", () => {
    const { center, fire } = setup();
    center.show({ title: "Привет", text: "мир" });
    center.show({ title: "Второе", kind: "success" });
    expect(center.items.map(item => [item.title, item.kind, item.source])).toEqual([["Привет", "info", "Бафия"], ["Второе", "success", "Бафия"]]);

    center.dismissId(center.items[0]!.id);
    expect(center.items.map(item => item.title)).toEqual(["Второе"]);
    fire();
    expect(center.items).toEqual([]);
  });

  test("одинаковый ключ обновляет на месте, без таймера (timeout 0) висит, пока не уберут по ключу", () => {
    const { center, timers } = setup();
    center.show({ key: "connection", title: "Нет связи", text: "попытка 1", timeout: 0 });
    center.show({ title: "Другое" });
    center.show({ key: "connection", title: "Нет связи", text: "попытка 2", timeout: 0 });

    expect(center.items.map(item => item.text)).toEqual(["попытка 2", ""]);
    expect(timers.size).toBe(1);                                  // только у «Другое»

    center.dismiss("connection");
    expect(center.items.map(item => item.title)).toEqual(["Другое"]);
    center.dismiss("нет такого");
  });

  test("не больше пяти сразу, самые старые уходят; длинный текст обрезается", () => {
    const { center } = setup();
    for(let i = 1; i <= 7; i++) center.show({ title: "№" + i, text: "x".repeat(1000) });
    expect(center.items.map(item => item.title)).toEqual(["№3", "№4", "№5", "№6", "№7"]);
    expect(center.items[0]!.text).toHaveLength(300);
  });
});
