import { JsonDocument } from "@common/storage";
import type { FileStore } from "@common/storage";

/** `/options.json` старой версии; неизвестные поля сохраняются как есть */
export interface LauncherOptions {
  /** userId выбранного аккаунта */
  profile: string
  windowsInFS: boolean
  hideDock: boolean
  devMode: boolean
  /** масштаб интерфейса; 1.5 - как в старой версии, где вся страница была увеличена в 1,5 раза */
  uiScale: number
  [extra: string]: unknown
}

export const defaultOptions = (): LauncherOptions => ({
  profile: "",
  windowsInFS: false,
  hideDock: false,
  devMode: false,
  uiScale: 1.5
});

const bool = (value: unknown, fallback: boolean) => typeof value == "boolean" ? value : fallback;

export const optionsDocument = (files: FileStore) =>
  new JsonDocument<LauncherOptions>(files, {
    path: "/options.json",
    defaults: defaultOptions,
    migrate(raw) {
      const saved = (typeof raw == "object" && raw !== null ? raw : {}) as Record<string, unknown>;
      const defaults = defaultOptions();
      return {
        ...saved,
        profile: typeof saved.profile == "string" ? saved.profile : defaults.profile,
        windowsInFS: bool(saved.windowsInFS, defaults.windowsInFS),
        hideDock: bool(saved.hideDock, defaults.hideDock),
        devMode: bool(saved.devMode, defaults.devMode),
        uiScale: typeof saved.uiScale == "number" && saved.uiScale >= .5 && saved.uiScale <= 3 ? saved.uiScale : defaults.uiScale
      };
    }
  });
