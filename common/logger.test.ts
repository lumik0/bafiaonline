import { expect, test } from "bun:test";
import { clearLogs, getLogs, getReportLogs, log } from "./logger";

test("журнал хранит последние записи и форматирует объекты и ошибки", () => {
  clearLogs();
  log("info", "привет", { a: 1 });
  log("error", new Error("сломалось"));
  for(let i = 0; i < 1100; i++) log("info", `запись ${i}`);

  expect(getLogs()).toHaveLength(1000);
  expect(getLogs().at(-1)).toContain("запись 1099");
  expect(getLogs().join("\n")).not.toContain("привет");
});

test("для отчёта берутся первые и последние 150 строк", () => {
  clearLogs();
  for(let i = 0; i < 500; i++) log("info", `запись ${i}`);
  const report = getReportLogs();

  expect(report).toHaveLength(301);
  expect(report[0]).toContain("запись 0");
  expect(report[149]).toContain("запись 149");
  expect(report[150]).toContain("пропущено строк: 200");
  expect(report[151]).toContain("запись 350");
  expect(report.at(-1)).toContain("запись 499");

  clearLogs();
  for(let i = 0; i < 10; i++) log("info", `запись ${i}`);
  expect(getReportLogs()).toHaveLength(10);
});
