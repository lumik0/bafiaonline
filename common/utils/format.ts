/** 99700 → "99 700" (с неразрывным пробелом, чтобы число не переносилось) */
export const formatNumber = (value: number) => Math.trunc(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function plural(n: number, forms: [string, string, string]) {
  if(n % 10 == 1 && n % 100 != 11) return forms[0];
  if(n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return forms[1];
  return forms[2];
}

/** 93784 → "1 день 2 часа 3 минуты 4 секунды"; нулевые части пропускаются */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const parts: [number, [string, string, string]][] = [
    [Math.floor(seconds / 86400), ["день", "дня", "дней"]],
    [Math.floor(seconds % 86400 / 3600), ["час", "часа", "часов"]],
    [Math.floor(seconds % 3600 / 60), ["минута", "минуты", "минут"]],
    [seconds % 60, ["секунда", "секунды", "секунд"]]
  ];
  const text = parts.filter(([n]) => n > 0).map(([n, forms]) => `${n} ${plural(n, forms)}`).join(" ");
  return text || "0 секунд";
}

/** 1700000000000 → "14.11.2023 22:13" (по местному времени) */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 1700000000000 → "14.11.2023" (по местному времени) */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** 93784 → "1 д 2 ч", 3700 → "1 ч 1 мин", 40 → "меньше минуты": коротко, до двух крупных частей */
export function formatPlayTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600), minutes = Math.floor(seconds % 3600 / 60);
  if(days) return `${days} д${hours ? ` ${hours} ч` : ""}`;
  if(hours) return `${hours} ч${minutes ? ` ${minutes} мин` : ""}`;
  return minutes ? `${minutes} мин` : "меньше минуты";
}
