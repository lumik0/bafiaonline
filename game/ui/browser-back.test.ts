import { describe, expect, test } from "bun:test";
import { DialogManager } from "@common/ui/dialog/manager";
import { ContextMenuManager } from "@common/ui/menu/manager";
import { Navigator } from "@common/ui/nav/navigator";
import type { GameContext } from "../context";
import type { Routes } from "../routes";
import { bindBrowserBack } from "./browser-back";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

/** браузер: история записей, кнопка «назад» и `history.go` присылают popstate */
function fakeBrowser() {
  const target = new EventTarget();
  const state = { extra: 0, pushes: 0, goes: [] as number[] };
  const history = {
    pushState() { state.extra++; state.pushes++; },
    go(delta: number) { state.goes.push(delta); state.extra += delta; queueMicrotask(() => target.dispatchEvent(new Event("popstate"))); }
  };
  /** «назад»: убирает запись и шлёт popstate, иначе выходит со страницы */
  const back = () => {
    if(state.extra == 0) return "вышли";
    state.extra--;
    target.dispatchEvent(new Event("popstate"));
    return "popstate";
  };
  return { history, target, state, back };
}

function setup(options: { active?: boolean } = {}) {
  const nav = new Navigator<Routes>();
  nav.push("menu");
  const dialogs = { manager: new DialogManager(), menu: new ContextMenuManager() };
  const ctx = {
    nav, dialogs, host: { window: { active: options.active ?? true } },
    backGuard: undefined as undefined | (() => boolean | Promise<boolean>),
    back: async() => {
      if(!nav.canGoBack) return;
      if(ctx.backGuard && !await ctx.backGuard()) return;
      nav.pop();
    }
  } as unknown as GameContext;
  const browser = fakeBrowser();
  const unbind = bindBrowserBack(ctx, browser.history, browser.target);
  return { ctx, nav, dialogs, browser, unbind };
}

describe("кнопка «назад» браузера (Android)", () => {
  test("на главном экране записей нет: «назад» выходит как обычно", () => {
    const { browser } = setup();
    expect(browser.state.extra).toBe(0);
    expect(browser.back()).toBe("вышли");
  });

  test("каждый экран добавляет запись, «назад» возвращает по экранам, потом выходит", async() => {
    const { nav, browser } = setup();
    nav.push("rooms");
    nav.push("roomCreation");
    expect(browser.state.extra).toBe(2);

    browser.back(); await tick();
    expect(nav.top?.name).toBe("rooms");
    browser.back(); await tick();
    expect(nav.top?.name).toBe("menu");
    expect(browser.state.extra).toBe(0);
    expect(browser.back()).toBe("вышли");
  });

  test("открытое окно и меню закрываются раньше экрана", async() => {
    const { nav, dialogs, browser } = setup();
    nav.push("rooms");
    void dialogs.manager.open({ render: () => null });
    expect(browser.state.extra).toBe(2);

    browser.back(); await tick();
    expect(dialogs.manager.isOpen).toBe(false);
    expect(nav.top?.name).toBe("rooms");
    expect(browser.state.extra).toBe(1);
    browser.back(); await tick();
    expect(nav.top?.name).toBe("menu");
  });

  test("возврат стрелкой в шапке убирает лишнюю запись и не вызывает второго «назад»", async() => {
    const { nav, browser } = setup();
    nav.push("rooms");
    nav.push("roomCreation");
    nav.pop();
    await tick(); await tick();

    expect(browser.state.goes).toEqual([-1]);
    expect(browser.state.extra).toBe(1);
    expect(nav.top?.name).toBe("rooms");
  });

  test("окно, которое нельзя закрыть, и запрет выхода из комнаты оставляют всё на месте и возвращают запись", async() => {
    const { ctx, nav, dialogs, browser } = setup();
    nav.push("rooms");
    void dialogs.manager.open({ render: () => null, dismissable: false });
    browser.back(); await tick();
    expect(dialogs.manager.isOpen).toBe(true);
    expect(browser.state.extra).toBe(2);
    dialogs.manager.closeAll();
    await tick(); await tick();

    ctx.backGuard = () => false;
    browser.back(); await tick();
    expect(nav.top?.name).toBe("rooms");
    expect(browser.state.extra).toBe(1);

    ctx.backGuard = () => true;
    browser.back(); await tick();
    expect(nav.top?.name).toBe("menu");
  });

  test("неактивное окно игры «назад» не обрабатывает, запись возвращается", async() => {
    const { nav, browser } = setup({ active: false });
    nav.push("rooms");
    browser.back(); await tick();
    expect(nav.top?.name).toBe("rooms");
    expect(browser.state.extra).toBe(1);
  });

  test("при закрытии игры добавленные записи убираются", async() => {
    const { nav, browser, unbind } = setup();
    nav.push("rooms");
    nav.push("roomCreation");
    unbind();
    await tick();
    expect(browser.state.extra).toBe(0);
  });
});
