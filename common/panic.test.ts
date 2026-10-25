import { describe, expect, test } from "bun:test";
import { buildReport, describeCrash, getId64, normalizeError } from "./panic";

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
});
