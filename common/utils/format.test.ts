import { expect, test } from "bun:test";
import { formatDateTime, formatDuration, formatNumber } from "./format";

test("formatNumber разделяет тысячи неразрывным пробелом", () => {
  expect(formatNumber(99700)).toBe("99 700");
  expect(formatNumber(1234567)).toBe("1 234 567");
  expect(formatNumber(12)).toBe("12");
});

test("formatDuration склоняет и пропускает нулевые части", () => {
  expect(formatDuration(93784)).toBe("1 день 2 часа 3 минуты 4 секунды");
  expect(formatDuration(2 * 86400 + 5 * 3600)).toBe("2 дня 5 часов");
  expect(formatDuration(21 * 60)).toBe("21 минута");
  expect(formatDuration(0)).toBe("0 секунд");
});

test("formatDateTime: день.месяц.год часы:минуты с нулями", () => {
  expect(formatDateTime(new Date(2023, 10, 4, 5, 7).getTime())).toBe("04.11.2023 05:07");
});
