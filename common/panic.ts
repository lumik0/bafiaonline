import { getLogs } from "./logger";

/** короткий отпечаток текста (FNV-1a): одинаковые ошибки получают одинаковый ID */
export function getId64(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;

  for(let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 = Math.imul((h2 ^ code) + 0x9e3779b9, 0x85ebca6b);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

export interface NormalizedError {
  message: string
  stack: string
}

/** ошибкой может оказаться что угодно (строка, пакет сервера): приводим к сообщению и стеку */
export function normalizeError(error: unknown): NormalizedError {
  if(error instanceof Error) return { message: error.message, stack: error.stack || error.message };
  if(typeof error == "string") return { message: error, stack: new Error(error).stack || error };

  try {
    const text = JSON.stringify(error);
    return { message: text, stack: new Error(text).stack || text };
  } catch {
    return { message: String(error), stack: String(error) };
  }
}

export interface CrashInfo {
  error: NormalizedError
  description: string
  /** какой экран был открыт */
  screen: string
}

/** описание для отчёта: явное, иначе по тексту ошибки */
export function describeCrash(error: NormalizedError, description?: unknown): string {
  if(typeof description == "string" && description) return description;
  if(typeof description == "object" && description !== null && typeof (description as { description?: unknown }).description == "string") return (description as { description: string }).description;
  return error.message.includes("WebSocket") ? "Ошибка соединения с сервером" : "Неизвестное";
}

export interface ReportEnvironment {
  version: string
  now?: Date
  width?: number
  height?: number
  pixelRatio?: number
  location?: string
  userAgent?: string
  logs?: readonly string[]
}

/** текст, который игрок присылает разработчику. Токены и пароли в нём не встречаются: журнал их скрывает */
export function buildReport(crash: CrashInfo, environment: ReportEnvironment): string {
  const { error } = crash;
  return `Скопируй весь текст и отправь
-------------------------------

Время: ${(environment.now ?? new Date()).toUTCString()}
Описание: ${crash.description}



${error.stack}



-- Детали --
ID отчёта: ${getId64(error.stack)}
Версия: ${environment.version}
Экран игры: ${crash.screen}
Размер окна: ${environment.width ?? "?"}x${environment.height ?? "?"}
DPR: ${environment.pixelRatio ?? "?"}
Адрес: ${environment.location ?? "?"}
Браузер: ${environment.userAgent ?? "?"}

-- Журнал --
${(environment.logs ?? getLogs()).join("\n")}
`;
}
