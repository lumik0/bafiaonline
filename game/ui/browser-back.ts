import type { GameContext } from "../context";

/** то, что нужно от `window.history`: тесты подставляют заглушку */
export interface HistoryLike {
  pushState(state: unknown, title: string): void
  go(delta: number): void
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

  const needed = () => Math.max(0, ctx.nav.depth - 1 + ctx.dialogs.manager.entries.length + (ctx.dialogs.menu.isOpen ? 1 : 0));

  const sync = () => {
    const need = needed();
    while(pushed < need) history.pushState({ bafia: ++pushed }, "");
    if(pushed > need) {
      const extra = pushed - need;
      pushed = need;
      ignore++;
      history.go(-extra);
    }
  };

  const onPop = () => {
    if(ignore > 0) {
      ignore--;
      return;
    }
    pushed = Math.max(0, pushed - 1);

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
      history.go(-pushed);
      pushed = 0;
    }
  };
}
