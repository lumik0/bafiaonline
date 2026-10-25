import { describe, expect, test } from "bun:test";
import { Navigator, type Transition } from "./navigator";

type Routes = { menu: {}, rooms: {}, room: { id: string } };

function setup() {
  const nav = new Navigator<Routes>();
  const log: Transition<Routes>[] = [];
  nav.on("change", transition => log.push(transition));
  return { nav, log };
}

describe("Navigator", () => {
  test("первый экран открывается без анимации, дальше push анимируется", () => {
    const { nav, log } = setup();
    nav.push("menu");
    nav.push("rooms");

    expect(log.map(t => [t.type, t.animate])).toEqual([["push", false], ["push", true]]);
    expect(nav.top?.name).toBe("rooms");
    expect(nav.canGoBack).toBe(true);
  });

  test("pop возвращает предыдущий экран, с корня идти некуда", () => {
    const { nav, log } = setup();
    nav.push("menu");
    nav.push("room", { id: "r1" });

    expect(nav.pop()).toBe(true);
    expect(log.at(-1)).toMatchObject({ type: "pop", from: { name: "room", params: { id: "r1" } }, to: { name: "menu" } });
    expect(nav.pop()).toBe(false);
    expect(nav.depth).toBe(1);
  });

  test("replace убирает текущий экран из истории, reset - всю историю", () => {
    const { nav } = setup();
    nav.push("menu");
    nav.push("rooms");
    nav.replace("room", { id: "x" });
    expect(nav.depth).toBe(2);
    expect(nav.previous?.name).toBe("menu");

    nav.reset("menu");
    expect(nav.depth).toBe(1);
    expect(nav.canGoBack).toBe(false);
  });

  test("один и тот же экран, открытый дважды, - разные записи", () => {
    const { nav } = setup();
    nav.push("menu");
    nav.push("room", { id: "1" });
    const first = nav.top!.key;
    nav.push("room", { id: "2" });
    expect(nav.top!.key).not.toBe(first);
  });

  test("типы: параметры обязательны там, где они нужны", () => {
    const check = () => {
      const nav = new Navigator<Routes>();
      // @ts-expect-error у room должен быть id
      nav.push("room");
      // @ts-expect-error нет такого экрана
      nav.push("nowhere");
      nav.push("menu");
    };
    expect(check).toBeFunction();
  });
});
