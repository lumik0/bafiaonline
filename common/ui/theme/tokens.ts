export type TokenKind = "color" | "size";

export interface TokenDefinition {
  /** CSS-переменная `--<key>` */
  key: string
  label: string
  kind: TokenKind
}

export interface TokenGroup {
  id: string
  label: string
  tokens: readonly TokenDefinition[]
}

const color = <K extends string>(key: K, label: string) => ({ key, label, kind: "color" }) as const;
const size = <K extends string>(key: K, label: string) => ({ key, label, kind: "size" }) as const;

/** всё, что игрок может перекрасить. Новое оформление = новый токен здесь и значения в presets.ts */
export const tokenGroups = [
  {
    id: "general", label: "Общие", tokens: [
      color("bg", "Фон"),
      color("text", "Текст"),
      color("text-dark", "Тёмный текст (на светлом)"),
      color("accent", "Акцент"),
      color("surface", "Панели"),
      color("surface-border", "Граница панелей"),
      color("dialog-bg", "Фон диалогового окна")
    ]
  },
  {
    id: "header", label: "Шапка", tokens: [
      color("header-bg", "Фон шапки"),
      color("header-text", "Текст шапки")
    ]
  },
  {
    id: "buttons", label: "Кнопки", tokens: [
      color("button-bg", "Фон кнопки"),
      color("button-text", "Текст кнопки"),
      color("button-hover", "Кнопка при наведении"),
      color("button-active", "Кнопка при нажатии"),
      color("button-disabled", "Неактивная кнопка"),
      color("button-border", "Граница кнопки"),
      size("button-radius", "Скругление кнопок"),
      color("button-gray-bg", "Серая кнопка"),
      color("button-gray-text", "Текст серой кнопки"),
      color("button-dark-bg", "Тёмная кнопка"),
      color("button-dark-text", "Текст тёмной кнопки")
    ]
  },
  {
    id: "menu", label: "Главное меню", tokens: [
      color("menu-overlay", "Затемнение фона меню"),
      color("button-shop-bg", "Кнопка «Магазин»"),
      color("button-shop-text", "Текст кнопки «Магазин»"),
      color("badge-bg", "Плашки (рейтинг, монеты)"),
      color("badge-text", "Текст плашек")
    ]
  },
  {
    id: "inputs", label: "Поля ввода", tokens: [
      color("input-bg", "Фон поля"),
      color("input-text", "Текст в поле"),
      color("input-accent", "Подчёркивание поля")
    ]
  },
  {
    id: "chat", label: "Чат", tokens: [
      color("chat-panel", "Фон списка сообщений"),
      color("chat-text", "Текст сообщений"),
      color("chat-name", "Ники"),
      color("chat-system", "Системные сообщения"),
      color("chat-mention", "Упоминание твоего ника"),
      color("chat-join", "«Игрок вошёл»"),
      color("chat-leave", "«Игрок вышел»"),
      color("chat-vote", "Голосование"),
      color("chat-dead", "Убитый игрок"),
      color("chat-info", "Сообщение о действии"),
      color("chat-giveup", "«Игрок сдался»"),
      color("chat-danger", "Убийство, взрыв, сдача"),
      color("chat-day", "Наступил день"),
      color("chat-night", "Ночь и мафия"),
      color("chat-unread-bg", "Непрочитанные личные сообщения")
    ]
  },
  {
    id: "progress", label: "Полоса опыта", tokens: [
      color("progress-fill", "Заполнение"),
      color("progress-track", "Фон полосы")
    ]
  },
  {
    id: "windows", label: "Окна и док", tokens: [
      color("desktop-bg", "Рабочий стол"),
      color("window-title-bg", "Заголовок окна"),
      color("window-title-inactive-bg", "Заголовок неактивного окна"),
      color("window-title-text", "Текст заголовка"),
      color("window-border", "Рамка окна"),
      color("window-bg", "Фон окна"),
      color("dock-bg", "Док"),
      color("dock-border", "Рамка дока"),
      color("dock-indicator", "Точка открытого окна")
    ]
  }
] as const satisfies readonly TokenGroup[];

export const tokens: readonly TokenDefinition[] = tokenGroups.flatMap(group => [...group.tokens]);

export type TokenKey = (typeof tokenGroups)[number]["tokens"][number]["key"];
export type ThemeValues = Record<TokenKey, string>;

const tokenByKey = new Map<string, TokenDefinition>(tokens.map(token => [token.key, token]));
export const getToken = (key: string) => tokenByKey.get(key);

const COLOR = /^(#[0-9a-f]{3,4}|#[0-9a-f]{6}|#[0-9a-f]{8}|transparent|(rgb|hsl)a?\(\s*[-\d.%]+(\s*[,\s/]\s*[-\d.%]+){2,3}\s*\))$/i;
const SIZE = /^\d+(\.\d+)?(px|rem|em|%)$/;

/** значение уходит в CSS-переменную, поэтому принимаем только цвета и размеры, а не произвольный текст */
export function isValidValue(kind: TokenKind, value: unknown): value is string {
  return typeof value == "string" && (kind == "color" ? COLOR : SIZE).test(value.trim());
}
