import { describe, expect, test } from "bun:test";
import { connectionText, createPicker } from "./loading";

describe("экран загрузки", () => {
  test("смайлики не повторяются подряд и пока не показаны все, на любых случайных числах", () => {
    for(const random of [() => 0, () => 0.999, Math.random, () => 0.5]) {
      const picker = createPicker(12, random);
      const picked = Array.from({ length: 120 }, () => picker.next());
      expect(picked.every((value, i) => i == 0 || value != picked[i - 1])).toBe(true);
      for(let start = 0; start < 120; start += 12) expect(new Set(picked.slice(start, start + 12)).size).toBe(12);
    }
  });

  test("один смайлик - не зависает", () => {
    expect(createPicker(1).next()).toBe(0);
  });

  test("текст по этапам: подключение, долго, сервер не отвечает, нет интернета; число попыток в конце", () => {
    expect(connectionText("connecting", 0)).toBe("Подключение…");
    expect(connectionText("slow", 0)).toBe("Не удаётся подключиться к серверу.\nПродолжаем попытки…");
    expect(connectionText("slow", 7)).toBe("Не удаётся подключиться к серверу.\nПродолжаем попытки… (7)");
    expect(connectionText("down", 12)).toContain("Сервер не отвечает.");
    expect(connectionText("down", 12)).toEndWith("(12)");
    expect(connectionText("slow", 3, false)).toContain("Нет подключения к интернету");
    expect(connectionText("down", 3, false)).toContain("Нет подключения к интернету");
  });
});
