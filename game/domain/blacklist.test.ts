import { describe, expect, test } from "bun:test";
import { addToBlacklist, blacklistLimit, cleanBlacklist, isBlacklisted, removeFromBlacklist, sameWho } from "./blacklist";

describe("чёрный список", () => {
  test("игрок узнаётся по id пользователя, id игрока или нику", () => {
    const entry = { userId: "u1", playerId: "p1", nick: "Лумик", at: 1 };
    expect(sameWho(entry, { userId: "u1" })).toBe(true);
    expect(sameWho(entry, { playerId: "p1" })).toBe(true);
    expect(sameWho(entry, { nick: " ЛУМИК " })).toBe(true);
    expect(sameWho(entry, { userId: "u2", playerId: "p2", nick: "Другой" })).toBe(false);
    expect(sameWho({ nick: "", at: 0 }, { nick: "" })).toBe(false);
  });

  test("добавление: дубль, лимит 5 и 50 с премиумом, пустое", () => {
    let list = [] as ReturnType<typeof cleanBlacklist>;
    for(let index = 1; index <= 5; index++) {
      const result = addToBlacklist(list, { nick: "игрок" + index, playerId: "p" + index }, blacklistLimit(false), index);
      expect("list" in result).toBe(true);
      if("list" in result) list = result.list;
    }
    expect(addToBlacklist(list, { nick: "новый" }, blacklistLimit(false))).toEqual({ error: "limit" });
    expect("list" in addToBlacklist(list, { nick: "новый" }, blacklistLimit(true))).toBe(true);
    expect(addToBlacklist(list, { nick: "Игрок1" }, 15)).toEqual({ error: "exists" });
    expect(addToBlacklist(list, { playerId: "p2", nick: "переименован" }, 15)).toEqual({ error: "exists" });
    expect(addToBlacklist([], { nick: "  " }, 5)).toEqual({ error: "empty" });
    expect(isBlacklisted(list, { playerId: "p3" })).toBe(true);
    expect(removeFromBlacklist(list, { playerId: "p3" })).toHaveLength(4);
  });

  test("список с сервера чистится: мусор отбрасывается, длина ограничена", () => {
    const cleaned = cleanBlacklist([{ nick: "а", userId: "u" }, 5, null, { nick: "" }, { nick: "б", playerId: 7 }, { nick: "в" }], 2);
    expect(cleaned).toEqual([{ nick: "а", userId: "u", at: 0 }, { nick: "б", at: 0 }]);
    expect(cleanBlacklist("x", 5)).toEqual([]);
  });
});
