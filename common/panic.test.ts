import { describe, expect, test } from "bun:test";
import { buildRemoteReport, buildReport, describeCrash, remoteLogs, getId64, normalizeError } from "./panic";

describe("паника", () => {
  test("ID отчёта одинаков для одинаковых ошибок и различается для разных", () => {
    expect(getId64("ошибка в Room")).toBe(getId64("ошибка в Room"));
    expect(getId64("ошибка в Room")).not.toBe(getId64("ошибка в Rooms"));
    expect(getId64("")).toHaveLength(16);
  });

  test("ошибкой может быть что угодно", () => {
    expect(normalizeError(new Error("упало")).message).toBe("упало");
    expect(normalizeError("строка").message).toBe("строка");
    expect(normalizeError({ ty: "странный пакет" }).message).toBe('{"ty":"странный пакет"}');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(normalizeError(circular).message).toBe("[object Object]");   // циклический объект не ломает отчёт
  });

  test("описание: явное, из объекта, по тексту ошибки", () => {
    const error = normalizeError(new Error("WebSocket closed"));
    expect(describeCrash(error, "после загрузки фото")).toBe("после загрузки фото");
    expect(describeCrash(error, { description: "из объекта" })).toBe("из объекта");
    expect(describeCrash(error)).toBe("Ошибка соединения с сервером");
    expect(describeCrash(normalizeError(new Error("что-то"))).length).toBeGreaterThan(0);
  });

  test("отчёт содержит стек, версию, экран и журнал", () => {
    const report = buildReport(
      { error: { message: "m", stack: "Error: m\n    at Комната.tsrx:10" }, description: "тест", screen: "room" },
      { version: "Beta 2.0", now: new Date(Date.UTC(2026, 9, 21, 12, 0)), width: 1280, height: 800, pixelRatio: 2, location: "https://x/play.html", userAgent: "UA", logs: ["строка журнала 1", "строка журнала 2"] }
    );

    expect(report).toContain("Описание: тест");
    expect(report).toContain("at Комната.tsrx:10");
    expect(report).toContain("Версия: Beta 2.0");
    expect(report).toContain("Экран игры: room");
    expect(report).toContain("Размер окна: 1280x800");
    expect(report).toContain("строка журнала 1\nстрока журнала 2");
    expect(report).toContain(`ID отчёта: ${getId64("Error: m\n    at Комната.tsrx:10")}`);
  });

  test("отчёт, который уходит сам: без трафика в журнале, без заголовка «скопируй», устройство и адрес грубо", () => {
    const logs = [
      "[12:00:00] INFO Бафия: связь с сервером восстановлена",
      "[12:00:01] INFO ← chatMessage {\"text\":\"привет, это личное\"}",
      "[12:00:02] INFO → sendRoomMessage {\"text\":\"секрет\"}",
      "[12:00:03] ERROR Необработанная ошибка: " + "x".repeat(600)
    ];
    expect(remoteLogs(logs)).toHaveLength(2);

    const report = buildRemoteReport(
      { error: { message: "m", stack: "Error: m\n    at Комната.tsrx:10" }, description: "тест", screen: "room" },
      { version: "Beta 2.2.3", width: 390, height: 844, pixelRatio: 3, platform: "ios", browser: "safari", site: "lumik0.github.io", logs }
    );
    expect(report).not.toContain("Скопируй");
    expect(report).not.toContain("привет, это личное");
    expect(report).not.toContain("секрет");
    expect(report).toContain("Браузер: ios, safari");
    expect(report).toContain("Адрес: lumik0.github.io");
    expect(report).toContain("Описание: тест");
    expect(report).toContain("связь с сервером восстановлена");
    expect(report).toMatch(/ID отчёта: [0-9a-f]{16}/);
    expect(report).toContain("…");
  });
});
