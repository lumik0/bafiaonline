import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import type { GameContext } from "../context";

/** запущено в оболочке приложения (Capacitor), а не в браузере */
export const isNativeApp = () => Capacitor.isNativePlatform();

/** системная кнопка «назад» в приложении: меню, окно, прошлый экран, а на главном экране закрывает окно игры (не сворачивает приложение) */
export function bindNativeBack(ctx: GameContext): () => void {
  const listener = App.addListener("backButton", async() => {
    if(ctx.dialogs.menu.isOpen) return ctx.dialogs.menu.close();
    if(ctx.dialogs.manager.dismissTop()) return;
    if(ctx.nav.canGoBack) return void await ctx.back();
    await ctx.host.window.close();
  });
  return () => void listener.then(handle => handle.remove());
}
