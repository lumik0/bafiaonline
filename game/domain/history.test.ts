import { describe, expect, test } from "bun:test";
import { recordTitle, sanitizeRecord } from "./history";

const valid = { messages: [{ a: 1 }], playersData: { p1: { role: 1 } }, modelType: 1, title: "Игра", maxPlayers: 8, minPlayers: 5, minLevel: 1, isVipEnabled: false, selectedRoles: [1, 2], gameDayTime: 60, createdAt: 5 };

describe("sanitizeRecord", () => {
  test("берёт только нужные поля и типы, остальное отбрасывает", () => {
    const record = sanitizeRecord({ ...valid, title: "я".repeat(200), selectedRoles: [1, "x", 3], messages: [{ a: 1 }, "строка", null], extra: "зло" });
    expect(record?.title).toHaveLength(80);
    expect(record?.selectedRoles).toEqual([1, 3]);
    expect(record?.messages).toEqual([{ a: 1 }]);
    expect(record).not.toHaveProperty("extra");
  });

  test("явный мусор и слишком большие записи не принимаются", () => {
    for(const bad of [null, [], "x", {}, { ...valid, messages: "нет" }, { ...valid, playersData: [] }, { ...valid, messages: Array(3001).fill({}) }, { ...valid, playersData: Object.fromEntries(Array.from({ length: 41 }, (_, i) => ["p" + i, {}])) }]) {
      expect(sanitizeRecord(bad)).toBeUndefined();
    }
  });

  test("название и заметка: берутся с ограничением длины, в списке название заменяет название комнаты", () => {
    const record = sanitizeRecord({ ...valid, name: "  Моё  ", note: "я".repeat(300) });
    expect(record?.name).toBe("Моё");
    expect(record?.note).toHaveLength(200);
    expect(sanitizeRecord({ ...valid, name: "   ", note: 5 })).toMatchObject({ name: undefined, note: undefined });

    expect(recordTitle({ ...record!, name: "Моё" })).toBe("Моё");
    expect(recordTitle({ ...record!, name: undefined, title: "Комната" })).toBe("Комната");
    expect(recordTitle({ ...record!, name: undefined, title: "" })).toBe("Игра");
  });
});
