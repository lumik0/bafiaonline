import { App } from "@capacitor/app";
import type { GameContext } from "../context";

/** системная кнопка «назад» в приложении: меню, окно, прошлый экран, а на главном экране сворачивает приложение, как обычные приложения Android */
export function bindNativeBack(ctx: GameContext): () => void {
  const listener = App.addListener("backButton", async() => {
    if(ctx.dialogs.menu.isOpen) return ctx.dialogs.menu.close();
    if(ctx.dialogs.manager.dismissTop()) return;
    if(ctx.nav.canGoBack) return void await ctx.back();
    // экран входа: назад - к списку аккаунтов
    if(ctx.nav.top?.name == "authorization") return void await ctx.host.window.close();
    await App.minimizeApp();
  });
  return () => void listener.then(handle => handle.remove());
}

/**
 * iOS: кнопки «назад» нет, поэтому жест - провести пальцем от левого края вправо (как в системных приложениях).
 * Работает как системная кнопка Android: закрывает меню, окно, возвращает на экран назад
 */
export function bindEdgeSwipeBack(ctx: GameContext): () => void {
  let start: { x: number, y: number } | undefined;
  const down = (event: TouchEvent) => {
    const touch = event.touches[0];
    start = event.touches.length == 1 && touch && touch.clientX < 24 ? { x: touch.clientX, y: touch.clientY } : undefined;
  };
  const up = async(event: TouchEvent) => {
    const touch = event.changedTouches[0], from = start;
    start = undefined;
    if(!from || !touch || touch.clientX - from.x < 70 || Math.abs(touch.clientY - from.y) > 60) return;
    if(ctx.dialogs.menu.isOpen) return ctx.dialogs.menu.close();
    if(ctx.dialogs.manager.dismissTop()) return;
    if(ctx.nav.canGoBack) await ctx.back();
    else if(ctx.nav.top?.name == "authorization") await ctx.host.window.close();
  };
  document.addEventListener("touchstart", down, { passive: true });
  document.addEventListener("touchend", up, { passive: true });
  return () => { document.removeEventListener("touchstart", down); document.removeEventListener("touchend", up); };
}
