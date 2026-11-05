import type { GameContext } from "../context";

/** то, что нужно от `window.history`: тесты подставляют заглушку */
export interface HistoryLike {
  pushState(state: unknown, title: string): void
  go(delta: number): void
  /** настоящий браузер отдаёт сюда номер записи; заглушка может не иметь */
  readonly state?: unknown
}

/**
 * кнопка «назад» закрывает окно или меню, потом возвращает на прошлый экран
 * без этого у страницы нет истории, и «назад» просто закрывает вкладку
 *
 * каждый «шаг назад» добавляет запись в историю; `popstate` значит «назад»
 * лишние записи убираются через `history.go`, их `popstate` игнорируется
 * на главном экране записей нет, и «назад» выходит из страницы как обычно
 */
export function bindBrowserBack(ctx: GameContext, history: HistoryLike = window.history, target: EventTarget = window): () => void {
  let pushed = 0;
  let ignore = 0;
  // куда мы сами отправили историю через `go`: пока не доехали, popstate не считается нажатием «назад»
  let pending: number | undefined;

  const needed = () => Math.max(0, ctx.nav.depth - 1 + ctx.dialogs.manager.entries.length + (ctx.dialogs.menu.isOpen ? 1 : 0));

  const sync = () => {
    const need = needed();
    while(pushed < need) history.pushState({ bafia: ++pushed }, "");
    if(pushed > need) {
      const extra = pushed - need;
      pushed = need;
      ignore++;
      pending = need;
      history.go(-extra);
    }
  };

  /** настоящий номер записи из браузера; `undefined`, если браузер его не отдаёт */
  const position = () => {
    if(!("state" in history)) return undefined;
    const state = history.state as { bafia?: unknown } | null | undefined;
    return typeof state?.bafia == "number" ? state.bafia : 0;
  };

  const onPop = () => {
    const real = position();
    if(real !== undefined) {
      // быстрые нажатия «назад» ломали счётчики, поэтому опираемся на настоящую позицию
      if(pending !== undefined && real == pending) {
        pending = undefined;
        ignore = 0;
        pushed = real;
        return;
      }
      pending = undefined;
      ignore = 0;
      pushed = Math.min(pushed, real);
    } else if(ignore > 0) {
      ignore--;
      return;
    } else {
      pushed = Math.max(0, pushed - 1);
    }

    // в неактивном окне игры «назад» ничего не делает: запись возвращается
    if(!ctx.host.window.active) return sync();
    if(ctx.dialogs.menu.isOpen) ctx.dialogs.menu.close();
    else if(!ctx.dialogs.manager.dismissTop()) return void ctx.back().finally(sync);
    sync();
  };

  const subscriptions = [ctx.nav.on("change", sync), ctx.dialogs.manager.on("change", sync), ctx.dialogs.menu.on("change", sync)];
  target.addEventListener("popstate", onPop);
  sync();

  return () => {
    for(const subscription of subscriptions) subscription.remove();
    target.removeEventListener("popstate", onPop);
    // игра закрыта: добавленные записи истории убираем, чтобы «назад» не ходило по пустым
    if(pushed > 0) {
      ignore++;
      pending = 0;
      history.go(-pushed);
      pushed = 0;
    }
  };
}
