import { describe, expect, test } from "bun:test";
import { backspaceAt, EMOJI_GROUPS } from "./emoji-data";

describe("смайлики", () => {
  test("в каждом разделе есть смайлики без пустых строк", () => {
    for(const group of EMOJI_GROUPS) {
      expect(group.items.length).toBeGreaterThan(20);
      expect(group.items.every(item => item.length > 0)).toBe(true);
    }
  });

  test("стирание убирает смайлик целиком, в том числе составной, и работает в середине текста", () => {
    expect(backspaceAt("ab😀", 4)).toEqual({ text: "ab", caret: 2 });
    expect(backspaceAt("a👨‍💻b", 6)).toEqual({ text: "ab", caret: 1 });
    expect(backspaceAt("abc", 2)).toEqual({ text: "ac", caret: 1 });
    expect(backspaceAt("abc", 0)).toEqual({ text: "abc", caret: 0 });
  });
});
