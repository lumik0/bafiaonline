import type { Assets } from "@common/assets";
import type { Bafia } from "./domain/bafia";
import type { CrashInfo } from "@common/panic";
import type { ServerClient } from "@common/net";
import type { Dialogs } from "@common/ui/dialog/dialogs";
import type { Navigator } from "@common/ui/nav/navigator";
import type { ThemeManager } from "@common/ui/theme";
import type { GameHost } from "@launcher/game";
import type { Auth } from "./domain/auth";
import type { Friends } from "./domain/friends";
import type { ProfileService } from "./domain/profile";
import type { RoomsList } from "./domain/rooms/rooms";
import type { RoomFilter } from "./domain/rooms/filter";
import type { HistoryFile } from "./domain/history";
import type { DocumentStore } from "./domain/store";
import type { SettingsStore } from "./domain/settings";
import type { User } from "./domain/user";
import type { ModManager } from "./mods/manager";
import type { Routes } from "./routes";

/** всё, что нужно экранам: передаётся им одним объектом вместо глобального App */
export interface GameContext {
  host: GameHost
  client: ServerClient
  auth: Auth
  user: User
  nav: Navigator<Routes>
  dialogs: Dialogs
  settings: SettingsStore
  profile: ProfileService
  friends: Friends
  /** подключение к списку комнат; экран «Комнаты» открывает и закрывает его сам */
  rooms: RoomsList
  roomFilter: DocumentStore<RoomFilter>
  /** сыгранные игры (`/game/history.json`, формат старой версии) */
  history: DocumentStore<HistoryFile>
  assets: Assets
  /** моды этой игры (окна): воркеры, права, команды */
  mods: ModManager
  /** сервер Бафии: «кто в Бафии», статистика, история ников; работает, только если игрок согласился */
  bafia: Bafia
  theme: ThemeManager
  /** окно с профилем игрока поверх текущего экрана */
  openProfile(playerObjectId: string): void
  /** игра упала: показываем экран с отчётом. `description` - что делал игрок или где случилось */
  panic(error: unknown, description?: unknown): void
  /** сведения о крахе; пока их нет, игра работает */
  crash: () => CrashInfo | undefined
  /** экран может спросить подтверждение перед «назад» (комната во время игры): вернуть false - остаться */
  backGuard?: () => boolean | Promise<boolean>
  /** назад по Esc, клавише ` и кнопке шапки: сначала охрана экрана, потом переход */
  back(): Promise<void>
}
