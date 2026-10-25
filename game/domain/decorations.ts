import { DECORATION_BASE } from "@common/constants";

/** типы украшений (номера как у сервера; разобрано по клиенту официального приложения) */
export const DecorationType = {
  UsernameAnimation: 0, UsernameBackground: 1, UsernameShadow: 2, UsernameText: 3,
  ProfileAnimation: 4, ProfileMainColor: 5, ProfileBackground: 6, PhotoBorderAnimation: 7, PhotoBorder: 8
} as const;

/** параметры украшения: номер → смысл */
export const DecorationParameter = { Alpha: 0, Color: 1, File: 2, Speed: 3 } as const;

export const decorationNames: Record<number, string> = {
  0: "Анимация никнейма", 1: "Фон никнейма", 2: "Тень никнейма", 3: "Цвет никнейма",
  4: "Анимация профиля", 5: "Основной цвет профиля", 6: "Фон профиля", 7: "Анимация рамки фото", 8: "Рамка фото"
};

export const decorationName = (type: number | undefined) => type === undefined ? "Украшение" : decorationNames[type] ?? `Украшение (тип ${type})`;

/** #AARRGGBB (так хранит приложение) → #RRGGBBAA для CSS; обычные #RRGGBB и #RGB остаются как есть */
export function argbToCss(value: unknown): string | undefined {
  if(typeof value != "string") return undefined;
  const argb = /^#([0-9a-f]{2})([0-9a-f]{6})$/i.exec(value.trim());
  if(argb) return `#${argb[2]}${argb[1]}`;
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : undefined;
}

/** украшения игрока в том виде, как приходят: тип → { параметр → значение } */
export type Decorations = Record<string, Record<string, string>>;

/** оставляет только то, что похоже на украшения; числа превращает в строки */
export function normalizeDecorations(raw: unknown): Decorations | undefined {
  if(typeof raw != "object" || raw === null || Array.isArray(raw)) return undefined;
  const result: Decorations = {};
  for(const [type, params] of Object.entries(raw)) {
    if(typeof params != "object" || params === null) continue;
    const clean: Record<string, string> = {};
    for(const [key, value] of Object.entries(params)) if(typeof value == "string" || typeof value == "number") clean[key] = String(value);
    result[type] = clean;
  }
  return Object.keys(result).length ? result : undefined;
}

/** прозрачность: приложение хранит целые проценты (0..100); `undefined`, если не число */
export function parseAlpha(value: string | undefined): number | undefined {
  if(value === undefined) return undefined;
  const number = Number.parseFloat(value);
  return Number.isNaN(number) ? undefined : Math.max(0, Math.min(1, number / 100));
}

/** цвет украшения: параметр «цвет», а если есть ещё «прозрачность» - с ней */
export function decorationColor(params: Record<string, string> | undefined): string | undefined {
  const color = argbToCss(params?.[String(DecorationParameter.Color)]);
  if(!color) return undefined;
  const alpha = parseAlpha(params?.[String(DecorationParameter.Alpha)]);
  if(alpha === undefined || !/^#[0-9a-f]{6}$/i.test(color)) return color;
  return color + Math.round(alpha * 255).toString(16).padStart(2, "0");
}

/** Lottie-анимация украшения: откуда грузить и как показывать */
export interface DecorationAnimation {
  /** адрес на сервере; из браузера его не прочитать (CORS), поэтому сначала ищем файл в образе по `path` */
  url: string
  path: string
  color?: string, speed: number, alpha: number }

/** анимация из украшения `type` (0 - ник, 4 - профиль, 7 - рамка фото); без имени файла её нет */
export function animationOf(decorations: Decorations | undefined, type: number): DecorationAnimation | undefined {
  const params = decorations?.[type];
  const file = params?.[DecorationParameter.File];
  if(!file || /[\\/]|\.\./.test(file)) return undefined;
  const folder = type == DecorationType.UsernameAnimation ? "username_animations" : "profile_animations";
  const speed = Number.parseFloat(params[DecorationParameter.Speed] ?? "");
  return {
    url: `${DECORATION_BASE}/${folder}/${encodeURIComponent(file)}`,
    path: `animations/${folder}/${file}`,
    color: argbToCss(params[DecorationParameter.Color]),
    speed: Number.isFinite(speed) && speed > 0 ? speed / 100 : 1,
    alpha: parseAlpha(params[DecorationParameter.Alpha]) ?? 1
  };
}

/**
 * как выглядит ник с украшениями: цвет текста, фон за ником, тень (свечение). Анимации рисует Lottie.tsrx
 */
export function nickStyle(decorations: Decorations | undefined): Record<string, string> {
  const style: Record<string, string> = {};
  if(!decorations) return style;
  const text = decorationColor(decorations[DecorationType.UsernameText]);
  const background = decorationColor(decorations[DecorationType.UsernameBackground]);
  const shadow = decorationColor(decorations[DecorationType.UsernameShadow]);
  if(text) style.color = text;
  if(background) Object.assign(style, { background, "border-radius": "6px", padding: "0 6px" });
  if(shadow) style["text-shadow"] = `0 0 3px ${shadow}, 0 0 7px ${shadow}`;
  return style;
}

/** рамка вокруг фото (цвет) для `box-shadow` */
export function photoRing(decorations: Decorations | undefined): string | undefined {
  const color = decorationColor(decorations?.[DecorationType.PhotoBorder]);
  return color ? `0 0 0 3px ${color}` : undefined;
}

/** цвета профиля: фон окна профиля и основной цвет (шапка) */
export function profileColors(decorations: Decorations | undefined): { background?: string, main?: string } {
  return {
    background: decorationColor(decorations?.[DecorationType.ProfileBackground]),
    main: decorationColor(decorations?.[DecorationType.ProfileMainColor])
  };
}

/** читаемый цвет текста на заданном фоне (#RRGGBB или #RRGGBBAA): светлый на тёмном, тёмный на светлом */
export function readableOn(background: string | undefined): string {
  const hex = /^#([0-9a-f]{6})/i.exec(background ?? "")?.[1];
  if(!hex) return "#121212";
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  const alpha = background!.length >= 9 ? parseInt(background!.slice(7, 9), 16) / 255 : 1;
  // яркость по восприятию; полупрозрачный фон светлеет за счёт белой подложки диалога
  const luminance = (0.299 * r! + 0.587 * g! + 0.114 * b!) * alpha + 255 * (1 - alpha);
  return luminance < 140 ? "#f2f2f2" : "#121212";
}
