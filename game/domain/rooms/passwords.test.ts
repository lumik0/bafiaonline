import { describe, expect, test } from "bun:test";
import { defaultGameSettings } from "@common/storage/settings";
import { forgetRoomPassword, rememberRoomPassword, ROOM_PASSWORD_MAX, ROOM_PASSWORD_TTL, savedRoomPassword } from "./passwords";

const store = () => {
  const data = defaultGameSettings(false);
  return { data, update: (change: (value: typeof data) => void) => change(data) };
};

describe("запомненные пароли комнат", () => {
  test("после входа пароль помнится, устаревший и забытый - нет", () => {
    const settings = store();
    expect(savedRoomPassword(settings, "r1")).toBeUndefined();
    rememberRoomPassword(settings, "r1", "hash1", 1000);
    expect(savedRoomPassword(settings, "r1", 2000)).toBe("hash1");
    expect(savedRoomPassword(settings, "r1", 1000 + ROOM_PASSWORD_TTL + 1)).toBeUndefined();
    forgetRoomPassword(settings, "r1");
    expect(savedRoomPassword(settings, "r1", 2000)).toBeUndefined();
    forgetRoomPassword(settings, "нет такой");   // ничего не ломает
  });

  test("повторный вход обновляет пароль, старые записи вычищаются, больше ROOM_PASSWORD_MAX комнат не хранится, пустое не сохраняется", () => {
    const settings = store();
    rememberRoomPassword(settings, "old", "x", 0);
    for(let i = 0; i < ROOM_PASSWORD_MAX + 5; i++) rememberRoomPassword(settings, "r" + i, "h" + i, ROOM_PASSWORD_TTL + 10 + i);
    expect(settings.data.roomPasswords["old"]).toBeUndefined();      // устарела
    expect(Object.keys(settings.data.roomPasswords)).toHaveLength(ROOM_PASSWORD_MAX);
    expect(settings.data.roomPasswords["r0"]).toBeUndefined();        // самые старые уходят первыми
    rememberRoomPassword(settings, "r40", "новый", ROOM_PASSWORD_TTL + 500);
    expect(savedRoomPassword(settings, "r40", ROOM_PASSWORD_TTL + 501)).toBe("новый");
    rememberRoomPassword(settings, "", "h");
    rememberRoomPassword(settings, "r50", "");
    expect(settings.data.roomPasswords[""]).toBeUndefined();
    expect(settings.data.roomPasswords["r50"]).toBeUndefined();
  });
});
