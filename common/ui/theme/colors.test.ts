import { describe, expect, test } from "bun:test";
import { formatColor, parseColor } from "./colors";
import { isValidValue } from "./tokens";

describe("цвета темы", () => {
  test("разбор всех видов записи", () => {
    expect(parseColor("#d03a41")).toEqual({ hex: "#d03a41", alpha: 1 });
    expect(parseColor("#FFF")).toEqual({ hex: "#ffffff", alpha: 1 });
    expect(parseColor("#0f08")?.hex).toBe("#00ff00");
    expect(parseColor("#ff000080")?.alpha).toBeCloseTo(0.5, 1);
    expect(parseColor("rgba(200, 200, 200, 0.4)")).toEqual({ hex: "#c8c8c8", alpha: 0.4 });
    expect(parseColor("rgb(10 20 30)")).toEqual({ hex: "#0a141e", alpha: 1 });
    expect(parseColor("rgb(10 20 30 / 50%)")?.alpha).toBe(0.5);
    expect(parseColor("transparent")?.alpha).toBe(0);
    expect(parseColor("hsl(10, 20%, 30%)")).toBeUndefined();
    expect(parseColor("красный")).toBeUndefined();
  });

  test("запись обратно принимается темой и читается так же", () => {
    for(const [hex, alpha] of [["#d03a41", 1], ["#c8c8c8", 0.4], ["#000000", 0], ["#ffffff", 0.82]] as const) {
      const value = formatColor(hex, alpha);
      expect(isValidValue("color", value)).toBe(true);
      const back = parseColor(value)!;
      expect(back.hex).toBe(hex);
      expect(back.alpha).toBeCloseTo(alpha, 2);
    }
    expect(formatColor("#d03a41", 1)).toBe("#d03a41");
    expect(formatColor("не цвет", 0.5)).toBe("не цвет");
  });
});
