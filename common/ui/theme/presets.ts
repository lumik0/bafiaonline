import type { ThemeValues } from "./tokens";

/** «Классика» - внешний вид, который был в игре: красный акцент на тёмном фоне */
const classic: ThemeValues = {
  "bg": "#000000",
  "text": "#e1dcdc",
  "text-dark": "#121212",
  "accent": "#d03a41",
  "surface": "rgba(200, 200, 200, 0.4)",
  "surface-border": "#918782",
  "dialog-bg": "#f1f0f1",

  "header-bg": "#d03a41",
  "header-text": "#e1dcdc",

  "button-bg": "#d03a41",
  "button-text": "#e1dcdc",
  "button-hover": "#a41b1e",
  "button-active": "#7a1215",
  "button-disabled": "#620d10",
  "button-border": "#000000",
  "button-radius": "7px",
  "button-gray-bg": "rgba(200, 200, 200, 0.4)",
  "button-gray-text": "#121212",
  "button-dark-bg": "#636262",
  "button-dark-text": "#363535",

  "menu-overlay": "rgba(107, 101, 96, 0.5)",
  "button-shop-bg": "#8fae60",
  "button-shop-text": "#1b1b1b",
  "badge-bg": "rgba(215, 215, 215, 0.92)",
  "badge-text": "#1b1b1b",

  "input-bg": "#ffffff",
  "input-text": "#000000",
  "input-accent": "#d03a41",

  "chat-panel": "rgba(255, 255, 255, 0.5)",
  "chat-text": "#000000",
  "chat-name": "#1b1b1b",
  "chat-system": "#333333",
  "chat-mention": "#ab1457",
  "chat-join": "#22640a",
  "chat-leave": "#940000",
  "chat-vote": "#186400",
  "chat-dead": "#545454",
  "chat-info": "#113b81",
  "chat-giveup": "#940000",
  "chat-danger": "#940000",
  "chat-day": "#c46509",
  "chat-night": "#4b4483",
  "chat-unread-bg": "rgba(150, 150, 150, 0.35)",
  "chat-join-bg": "transparent",
  "chat-leave-bg": "transparent",
  "chat-vote-bg": "transparent",
  "chat-danger-bg": "transparent",
  "chat-day-bg": "transparent",
  "chat-night-bg": "transparent",
  "chat-info-bg": "transparent",
  "chat-dead-bg": "transparent",
  "chat-text-bg": "transparent",
  "chat-visit-doctor": "#0b6b5a",
  "chat-visit-doctor-bg": "transparent",
  "chat-visit-lover": "#b0246a",
  "chat-visit-lover-bg": "transparent",
  "chat-visit-sheriff": "#113b81",
  "chat-visit-sheriff-bg": "transparent",
  "chat-visit-barman": "#7a4a12",
  "chat-visit-barman-bg": "transparent",
  "chat-visit-informer": "#4b4483",
  "chat-visit-informer-bg": "transparent",
  "chat-visit-mafia": "#940000",
  "chat-visit-mafia-bg": "transparent",

  "progress-fill": "#3b82f6",
  "progress-track": "#e5e5e5",

  "desktop-bg": "#242424",
  "window-title-bg": "#e4e2e4",
  "window-title-inactive-bg": "#f1f0f1",
  "window-title-text": "#1d1d1f",
  "window-border": "#b7b6b7",
  "window-bg": "#000000",
  "dock-bg": "rgba(19, 31, 34, 0.85)",
  "dock-border": "#3d4748",
  "dock-indicator": "#ffffff"
};

export interface ThemePreset {
  id: string
  label: string
  values: ThemeValues
  /** анимированные эффекты по умолчанию (см. `effects`) */
  effect?: string
  /** обои меню и всех экранов: путь в образе игры; без них - стандартные */
  wallpaper?: { path: string, position: string }
}

/** обои по умолчанию (у «Классики» и своих тем): человек в костюме слева */
export const defaultWallpaper = { path: "textures/backgrounds/menu3.png", position: "left center" };

/** эффекты поверх интерфейса: частицы и свечение. Выбираются отдельно от цветов */
export const effects = [
  { id: "none", label: "Без эффектов" },
  { id: "halloween", label: "Хэллоуин" }
] as const;

export type EffectId = typeof effects[number]["id"];

export const presets: readonly ThemePreset[] = [
  { id: "classic", label: "Классика", values: classic },
  {
    id: "midnight", label: "Полночь", values: {
      ...classic,
      "bg": "#0b0d14",
      "accent": "#7c5cff",
      "header-bg": "#1a1d2e",
      "button-bg": "#3a2f8f",
      "button-hover": "#2c2370",
      "button-active": "#211a54",
      "button-disabled": "#1d1a3a",
      "input-accent": "#7c5cff",
      "window-bg": "#0b0d14"
    }
  },
  {
    id: "halloween", label: "Хэллоуин", effect: "halloween", values: {
      ...classic,
      "bg": "#120a05",
      "text": "#f3e3cf",
      "accent": "#ff7a1a",
      "surface": "rgba(120, 70, 30, 0.45)",
      "surface-border": "#7a4a20",
      "dialog-bg": "#f3e3cf",
      "header-bg": "#3a1458",
      "header-text": "#ffd9a8",
      "button-bg": "#d9620c",
      "button-text": "#fff1de",
      "button-hover": "#ad4a06",
      "button-active": "#7d3503",
      "button-disabled": "#4d2a12",
      "button-border": "#120a05",
      "input-accent": "#ff7a1a",
      "menu-overlay": "rgba(40, 18, 60, 0.5)",
      "chat-panel": "rgba(255, 233, 205, 0.55)",
      "chat-mention": "#c4167a",
      "chat-night": "#5a2d99",
      "chat-day": "#c4540a",
      "progress-fill": "#ff7a1a",
      "desktop-bg": "#140b1f",
      "window-bg": "#120a05",
      "window-title-bg": "#2a1340",
      "window-title-inactive-bg": "#1e1030",
      "window-title-text": "#ffd9a8",
      "window-border": "#5a2d99",
      "dock-bg": "rgba(42, 19, 64, 0.85)",
      "dock-border": "#7a4a20"
    }
  },
  // светлая и тёмная темы: каждая со своими обоями
  {
    id: "dark", label: "Тёмная", wallpaper: { path: "textures/backgrounds/dark.jpg", position: "center" }, values: {
      ...classic,
      "bg": "#0c0c0e",
      "text": "#ececec",
      "text-dark": "#ececec",
      "accent": "#d03a41",
      "surface": "rgba(28, 28, 32, 0.68)",
      "surface-border": "#4a4a50",
      "dialog-bg": "#26262b",
      "header-bg": "#1b1b1f",
      "header-text": "#ececec",
      "button-bg": "#b8323a",
      "button-hover": "#8f2429",
      "button-active": "#6c1a1f",
      "button-disabled": "#3a1a1c",
      "button-gray-bg": "rgba(255, 255, 255, 0.14)",
      "button-gray-text": "#ececec",
      "button-dark-bg": "#3a3a3f",
      "button-dark-text": "#b8b8b8",
      "menu-overlay": "rgba(0, 0, 0, 0.3)",
      "badge-bg": "rgba(40, 40, 44, 0.92)",
      "badge-text": "#ececec",
      "input-bg": "#1f1f24",
      "input-text": "#ececec",
      "chat-panel": "rgba(16, 16, 20, 0.62)",
      "chat-text": "#ececec",
      "chat-name": "#ffffff",
      "chat-system": "#b8b8b8",
      "chat-mention": "#ff7ab0",
      "chat-join": "#6fdc63",
      "chat-leave": "#ff7676",
      "chat-vote": "#7be86a",
      "chat-dead": "#9b9ba2",
      "chat-info": "#86b4ff",
      "chat-giveup": "#ff7676",
      "chat-danger": "#ff7676",
      "chat-day": "#ffae57",
      "chat-night": "#aca0ff",
      "chat-unread-bg": "rgba(255, 255, 255, 0.14)",
      "chat-visit-doctor": "#4fd8bd",
      "chat-visit-lover": "#ff7ab9",
      "chat-visit-sheriff": "#86b4ff",
      "chat-visit-barman": "#e0a35c",
      "chat-visit-informer": "#aca0ff",
      "chat-visit-mafia": "#ff7676",
      "progress-track": "#3a3a40",
      "desktop-bg": "#0c0c0e",
      "window-bg": "#0c0c0e",
      "window-title-bg": "#232327",
      "window-title-inactive-bg": "#18181b",
      "window-title-text": "#ececec",
      "window-border": "#3a3a40",
      "dock-bg": "rgba(24, 24, 28, 0.85)",
      "dock-border": "#3a3a40"
    }
  },
  {
    id: "daylight", label: "Светлая", wallpaper: { path: "textures/backgrounds/light.jpg", position: "center" }, values: {
      ...classic,
      "bg": "#f2f2f2",
      "text": "#1b1b1b",
      "surface": "rgba(255, 255, 255, 0.7)",
      "surface-border": "#c4c4c4",
      "dialog-bg": "#ffffff",
      "header-text": "#ffffff",
      "button-text": "#ffffff",
      "menu-overlay": "rgba(255, 255, 255, 0.25)",
      "badge-bg": "rgba(255, 255, 255, 0.92)",
      "chat-panel": "rgba(255, 255, 255, 0.72)",
      "progress-track": "#d4d4d4",
      "desktop-bg": "#dcdcdc",
      "dock-bg": "rgba(240, 240, 240, 0.85)",
      "dock-border": "#bbbbbb",
      "dock-indicator": "#333333"
    }
  }
];

export const defaultPresetId = "classic";
/** встроенные темы нельзя удалить, но можно настроить */
export const isBuiltIn = (id: string) => presets.some(preset => preset.id == id);
export const getPreset = (id: string) => presets.find(preset => preset.id == id);
