import { Assets, type AssetsSource } from "@common/assets";
import { installErrorHooks } from "@common/logger";
import { openStorage } from "@common/storage";
import { injectStyle, mount } from "@common/ui";
import { ThemeManager } from "@common/ui/theme";
import { baseCss } from "@common/ui/theme/base";
import { applyPlatform } from "@common/ui/platform";
import { NotificationCenter } from "@common/ui/notifications/center";
import { NotificationLayer } from "@common/ui/notifications/NotificationLayer.tsrx";
import { EffectsLayer } from "@common/ui/effects/EffectsLayer.tsrx";
import type { GameLauncher } from "./game";
import { LauncherModel } from "./model";
import { AppHome } from "./ui/AppHome.tsrx";
import { Desktop } from "./ui/Desktop.tsrx";
import { WindowManager } from "./windows/manager";
import { mountInWindow } from "./windows/mount";

/**
 * приложение (Android, iOS): без рабочего стола с окнами. Игра открывается сразу на весь экран с последним аккаунтом;
 * под ней экран аккаунтов - он виден при первом запуске и после «Сменить аккаунт»
 */
export async function startApp(root: HTMLElement, launchGame: GameLauncher, assetsSource?: AssetsSource) {
  installErrorHooks();
  injectStyle("base", baseCss);
  applyPlatform();

  const storage = await openStorage(true);
  const theme = new ThemeManager(document.documentElement, storage.files);
  await theme.load();

  // окна остаются как механизм (игра живёт в окне), но каждое занимает весь экран, без заголовка и масштаба
  const manager = new WindowManager({ mobile: true, scale: 1 });
  const notifications = new NotificationCenter();
  const assets = new Assets(storage.files);
  await assets.init();
  const model = new LauncherModel({ storage, manager, theme, assets, notifications, launchGame, gameWindow: { titleBar: false, zoom: 1, fullscreen: true } });
  await model.load();

  mount(() => Desktop({ manager, showDock: () => false }) as never, root);
  mount(() => NotificationLayer({ center: notifications }) as never, document.body.appendChild(document.createElement("div")));
  mount(() => EffectsLayer({ theme }) as never, document.body.appendChild(document.createElement("div")));

  model.window = manager.open({ title: "Бафия онлайн", titleBar: false, closable: false, fullscreen: true });
  mountInWindow(model.window, () => AppHome({ model }) as never);

  // файлы игры лежат внутри приложения: проверка быстрая, после неё сразу игра с последним аккаунтом
  if(assetsSource) await model.syncAssets(assetsSource);
  // последний аккаунт; если он один, выбирать нечего
  const last = model.selected ?? (model.accounts.length == 1 ? model.accounts[0] : undefined);
  if(last) void model.play(last);

  return { manager, model, theme, storage, assets };
}
