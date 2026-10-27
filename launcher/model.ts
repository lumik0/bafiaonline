import { syncAssets, type Assets, type AssetsSource } from "@common/assets";
import { importFromLegacy, type Account } from "@common/storage";
import type { Notifier } from "@common/ui/notifications/center";
import { versionNumber } from "@common/version";
import type { ThemeManager } from "@common/ui/theme";
import Events from "@common/utils/emitter";
import { alert, confirm } from "./dialogs";
import type { GameLauncher, Storage } from "./game";
import { optionsDocument, type LauncherOptions, defaultOptions } from "./options";
import type { WindowHandle, WindowManager } from "./windows/manager";

export const accountKey = (account: Account) => account.userId || account.email || account.name;
export const accountTitle = (account: Account) => account.name || account.email || "Без имени";

export interface LauncherDeps {
  storage: Storage
  manager: WindowManager
  theme: ThemeManager
  assets: Assets
  notifications: Notifier
  launchGame: GameLauncher
}

/** логика окна лаунчера: аккаунты, выбор, запуск игры, настройки. Рисует всё это Launcher.tsrx */
export class LauncherModel extends Events<{ change: () => void }> {
  accounts: Account[] = [];
  options: LauncherOptions = defaultOptions();
  selected?: Account;
  status = "";
  /** идёт загрузка картинок: играть пока нельзя */
  syncing = false;
  progress = { value: 0, max: 0 };
  /** окно самого лаунчера; блокируется, пока запускается игра */
  window?: WindowHandle;

  private optionsDoc;

  constructor(readonly deps: LauncherDeps) {
    super();
    this.optionsDoc = optionsDocument(deps.storage.files);
  }

  async load() {
    this.options = await this.optionsDoc.read();
    await this.reloadAccounts();
  }

  async reloadAccounts() {
    this.accounts = await this.deps.storage.accounts.list();
    this.selected = this.accounts.find(account => account.userId && account.userId == this.options.profile);
    this.emit("change");
  }

  select(account: Account) {
    this.selected = account;
    this.emit("change");
  }

  async setOption<K extends "windowsInFS" | "hideDock" | "devMode">(key: K, value: boolean) {
    await this.optionsDoc.update(options => { options[key] = value; });
    this.options = { ...this.options, [key]: value };
    this.emit("change");
  }

  async setScale(scale: number) {
    await this.optionsDoc.update(options => { options.uiScale = scale; });
    this.options = { ...this.options, uiScale: scale };
    this.deps.manager.setScale(scale);
    this.emit("change");
  }

  /** проверяет картинки игры и докачивает недостающие; прогресс виден в окне лаунчера */
  async syncAssets(source: AssetsSource) {
    const { storage, assets } = this.deps;
    this.syncing = true;
    this.status = "Проверка файлов…";
    this.emit("change");

    try {
      const result = await syncAssets(storage.files, source, ({ checked, total, written }) => {
        this.progress = { value: checked, max: total };
        if(written) this.status = `Скачано файлов: ${written}`;
        this.emit("change");
      });
      this.status = result.written.length ? `Обновлено файлов: ${result.written.length}` : "";
      // уже загруженные картинки могли поменяться
      for(const path of result.written) if(assets.isCustom(path) == false) void assets.reload(path);
    } catch(error) {
      this.status = `Не удалось загрузить файлы игры: ${error instanceof Error ? error.message : error}`;
    } finally {
      this.syncing = false;
      this.emit("change");
    }
  }

  /** account не задан - игра сама спросит почту и пароль */
  async play(account?: Account) {
    const { manager, launchGame, storage, theme, assets, notifications } = this.deps;
    this.window?.lock();
    try {
      if(account?.userId && this.options.profile != account.userId) {
        await this.optionsDoc.update(options => { options.profile = account.userId!; });
        this.options = { ...this.options, profile: account.userId };
      }

      const window = manager.open({
        title: `Бафия ${versionNumber}`, icon: "🎮",
        width: 400, height: 500, minWidth: 250, minHeight: 400,
        center: true, zoom: .7, fullscreen: this.options.windowsInFS
      });
      window.on("close", () => void this.reloadAccounts());
      await launchGame({ window, manager, storage, theme, assets, notifications, account });
    } catch(error) {
      await alert(manager, `Не удалось запустить игру\n\n${error instanceof Error ? error.message : error}`, "Ошибка");
    } finally {
      this.window?.unlock();
    }
  }

  async remove(account: Account) {
    const { manager, storage } = this.deps;
    if(!await confirm(manager, `Удалить аккаунт «${accountTitle(account)}»?\n\nОн пропадёт из списка. Сам игровой аккаунт останется.`, "Удаление", "Удалить")) return;

    await storage.accounts.remove(other => other === account || accountKey(other) == accountKey(account));
    this.status = `Аккаунт ${accountTitle(account)} удалён`;
    if(this.selected && accountKey(this.selected) == accountKey(account)) this.selected = undefined;
    await this.reloadAccounts();
  }

  async exportAccounts(save: (name: string, text: string) => void) {
    const { manager, storage } = this.deps;
    if(!await confirm(manager, "В файле будут почты и пароли твоих аккаунтов в открытом виде.\nХрани его как пароль и никому не отправляй.", "Экспорт аккаунтов", "Скачать")) return;
    save("bafia-accounts.json", await storage.accounts.exportJson());
  }

  async importAccounts(json: string) {
    const { manager, storage } = this.deps;
    try {
      const count = await storage.accounts.importJson(json);
      await this.reloadAccounts();
      await alert(manager, `Добавлено аккаунтов: ${count}`, "Импорт");
    } catch(error) {
      await alert(manager, error instanceof Error ? error.message : String(error), "Ошибка импорта");
    }
  }

  /** добавляет аккаунты из старой версии (её данные не меняются); те, что уже есть, обновляются */
  async importFromLegacy() {
    const { manager, storage } = this.deps;
    try {
      const result = await importFromLegacy(storage.files, storage.accounts);
      await this.reloadAccounts();
      await alert(manager, result.noLegacy ? "Данных старой версии в этом браузере нет" : `Аккаунтов из старой версии: ${result.accounts}`, "Импорт из старой версии");
    } catch(error) {
      await alert(manager, error instanceof Error ? error.message : String(error), "Ошибка импорта");
    }
  }

  /** стирает данные новой версии (IndexedDB BafiaOnline2); старая не трогается */
  async eraseEverything() {
    const { manager, storage } = this.deps;
    const text = "Будут удалены данные новой версии в этом браузере: аккаунты, настройки, оформление и свои картинки.\nСтарая версия и другие сайты не затрагиваются.\n\nВосстановить данные будет невозможно.";
    if(!await confirm(manager, text, "Очистить все данные", "Очистить")) return;
    await storage.files.clear();
    location.reload();
  }
}
