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

  "menu-overlay": "rgba(107, 101, 96, 0.82)",
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
}

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
      "menu-overlay": "rgba(40, 18, 60, 0.82)",
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
  }
];

export const defaultPresetId = "classic";
/** встроенные темы нельзя удалить, но можно настроить */
export const isBuiltIn = (id: string) => presets.some(preset => preset.id == id);
export const getPreset = (id: string) => presets.find(preset => preset.id == id);
