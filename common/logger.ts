/** журнал для окна «Логи»: последние записи, можно скопировать в отчёт об ошибке */
const MAX_LINES = 1000;
const lines: string[] = [];

type Level = "info" | "warn" | "error";

function format(value: unknown): string {
  if(typeof value == "string") return value;
  if(value instanceof Error) return value.stack ?? value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function log(level: Level, ...args: unknown[]) {
  lines.push(`[${new Date().toLocaleTimeString("ru-RU")}] ${level.toUpperCase()} ${args.map(format).join(" ")}`);
  if(lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
}

export const getLogs = (): readonly string[] => lines;
export const clearLogs = () => { lines.length = 0; };

/** необработанные ошибки страницы тоже попадают в журнал */
export function installErrorHooks(target: Window = window) {
  target.addEventListener("error", event => log("error", event.message, event.error));
  target.addEventListener("unhandledrejection", event => log("error", "Необработанная ошибка:", event.reason));
}
