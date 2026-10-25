import type { Assets } from "@common/assets";
import type { Account, createStorage } from "@common/storage";
import type { Notifier } from "@common/ui/notifications/center";
import type { ThemeManager } from "@common/ui/theme";
import type { WindowHandle, WindowManager } from "./windows/manager";

export type Storage = ReturnType<typeof createStorage>;

/** что лаунчер даёт игре при запуске; игра рисует в `window.content` */
export interface GameHost {
  window: WindowHandle
  manager: WindowManager
  storage: Storage
  theme: ThemeManager
  assets: Assets
  /** уведомления в углу экрана (как в macOS): общие на весь лаунчер */
  notifications: Notifier
  /** аккаунт для входа; без него игра показывает экран входа */
  account?: Account
}

export type GameLauncher = (host: GameHost) => void | Promise<void>;
