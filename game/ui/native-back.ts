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
