import { Assets, type AssetsSource } from "@common/assets";
import { installErrorHooks } from "@common/logger";
import { migrateOnFirstRun, openStorage } from "@common/storage";
import { fromEvents, injectStyle, mount } from "@common/ui";
import { ThemeManager } from "@common/ui/theme";
import { baseCss } from "@common/ui/theme/base";
import { NotificationCenter } from "@common/ui/notifications/center";
import { NotificationLayer } from "@common/ui/notifications/NotificationLayer.tsrx";
import { EffectsLayer } from "@common/ui/effects/EffectsLayer.tsrx";
import { ThemeWindow } from "./ui/ThemeWindow.tsrx";
import { isMobile } from "@common/utils/mobile";
import { version } from "@common/version";
import type { GameLauncher } from "./game";
import { LauncherModel } from "./model";
import { optionsDocument } from "./options";
import { Desktop } from "./ui/Desktop.tsrx";
import { Launcher } from "./ui/Launcher.tsrx";
import { Settings } from "./ui/Settings.tsrx";
import { WindowManager } from "./windows/manager";
import { mountInWindow } from "./windows/mount";

/** поднимает рабочий стол с окнами и открывает окно лаунчера. `launchGame` - как запускается сама игра */
export async function startLauncher(root: HTMLElement, launchGame: GameLauncher, assetsSource?: AssetsSource) {
  installErrorHooks();
  injectStyle("base", baseCss);

  const storage = await openStorage(isMobile());
  // игроки старой версии: аккаунты переезжают из её базы сами, один раз
  const migration = await migrateOnFirstRun(storage.files, storage.accounts).catch(() => undefined);
  const theme = new ThemeManager(document.documentElement, storage.files);
  await theme.load();

  const { uiScale } = await optionsDocument(storage.files).read();
  // док занимает нижние ~70 единиц; пока его нет (скрыт, телефон), окна могут занять весь экран
  const dockHeight = () => !isMobile() && !model.options.hideDock && !model.options.windowsInFS ? 72 : 0;
  const manager = new WindowManager({ mobile: isMobile(), scale: uiScale, reserveBottom: () => dockHeight() });
  const notifications = new NotificationCenter();
  const assets = new Assets(storage.files);
  await assets.init();
  const model = new LauncherModel({ storage, manager, theme, assets, notifications, launchGame });
  await model.load();
  if(migration?.accounts) model.status = `Перенесено аккаунтов из старой версии: ${migration.accounts}`;

  const showDock = () => !isMobile() && !model.options.hideDock && !model.options.windowsInFS;
  mount(() => Desktop({ manager, showDock: fromEvents(model, "change", showDock) }) as never, root);

  mount(() => NotificationLayer({ center: notifications }) as never, document.body.appendChild(document.createElement("div")));
  mount(() => EffectsLayer({ theme }) as never, document.body.appendChild(document.createElement("div")));

  const openTheme = () => {
    const window = manager.open({ title: "Оформление", icon: "🎨", width: 440, height: 560, fullscreen: model.options.windowsInFS });
    mountInWindow(window, () => ThemeWindow({ theme, assets }) as never);
    window.on("close", () => void theme.flush());
  };

  const openSettings = () => {
    const window = manager.open({
      title: "Настройки", icon: "🛠", popup: true, center: true,
      width: 340, height: 430, resizable: false, minimizable: false, maximizable: false
    });
    model.window?.lock();
    window.on("close", () => model.window?.unlock());
    mountInWindow(window, () => Settings({ model, openTheme }) as never);
  };

  model.window = manager.open({
    title: `Лаунчер (${version})`, icon: "🚀",
    width: 420, height: 520, center: true, closable: false, fullscreen: model.options.windowsInFS
  });
  mountInWindow(model.window, () => Launcher({ model, openSettings }) as never);

  // картинки докачиваются в фоне: лаунчер уже на экране
  if(assetsSource) void model.syncAssets(assetsSource);

  return { manager, model, theme, storage, assets };
}
