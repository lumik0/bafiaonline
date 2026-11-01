/** журнал для окна «Логи»: последние записи, можно скопировать в отчёт об ошибке */
const MAX_LINES = 1000;
const lines: string[] = [];
/** сколько первых и последних строк идёт в отчёт об ошибке */
export const REPORT_EDGE = 150;
// первые строки не вытесняются, чтобы начало сессии не терялось
const head: string[] = [];
let total = 0;

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
  const line = `[${new Date().toLocaleTimeString("ru-RU")}] ${level.toUpperCase()} ${args.map(format).join(" ")}`;
  if(head.length < REPORT_EDGE) head.push(line);
  total++;
  lines.push(line);
  if(lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
}

export const getLogs = (): readonly string[] => lines;
export const clearLogs = () => { lines.length = 0; head.length = 0; total = 0; };

/** для отчёта: первые и последние REPORT_EDGE строк, середина заменяется пометкой */
export function getReportLogs(): string[] {
  if(total <= REPORT_EDGE * 2) return lines.slice(-total);
  const tail = lines.slice(-REPORT_EDGE);
  return [...head, `... пропущено строк: ${total - REPORT_EDGE * 2} ...`, ...tail];
}

/** необработанные ошибки страницы тоже попадают в журнал */
export function installErrorHooks(target: Window = window) {
  target.addEventListener("error", event => log("error", event.message, event.error));
  target.addEventListener("unhandledrejection", event => log("error", "Необработанная ошибка:", event.reason));
}
