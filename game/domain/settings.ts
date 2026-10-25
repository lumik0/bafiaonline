import type { GameSettings } from "@common/storage";
import { DocumentStore } from "./store";

/** настройки игры */
export type SettingsStore = DocumentStore<GameSettings>;
export const SettingsStore = DocumentStore<GameSettings>;
