import { expect, test } from "bun:test";
import { clearLogs, getLogs, log } from "./logger";

test("журнал хранит последние записи и форматирует объекты и ошибки", () => {
  clearLogs();
  log("info", "привет", { a: 1 });
  log("error", new Error("сломалось"));
  for(let i = 0; i < 1100; i++) log("info", `запись ${i}`);

  expect(getLogs()).toHaveLength(1000);
  expect(getLogs().at(-1)).toContain("запись 1099");
  expect(getLogs().join("\n")).not.toContain("привет");
});
