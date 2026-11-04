import { describe, expect, test } from "bun:test";
import { belongsTo, HISTORY_LIMIT, noteHint, ownRecords, recordTitle, sanitizeRecord, sharedForm, withRecord, type HistoryRecord } from "./history";

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

describe("noteHint", () => {
  const record = (note?: string) => ({ ...(sanitizeRecord(valid) as HistoryRecord), note });

  test("описание идёт в список выбора через дефис одной строкой, длинное обрезается, без описания пусто", () => {
    expect(noteHint(record())).toBe("");
    expect(noteHint(record("   "))).toBe("");
    expect(noteHint(record("Сильная игра\n  за чёрных"))).toBe(" - Сильная игра за чёрных");
    const long = noteHint(record("я".repeat(100)));
    expect(long).toBe(" - " + "я".repeat(69) + "…");
  });

  test("описание есть и при ненастоящем названии: название игры от описания не зависит", () => {
    expect(recordTitle(record("только описание"))).toBe("Игра");
  });
});

describe("история у каждого аккаунта своя", () => {
  const base = sanitizeRecord(valid) as HistoryRecord;
  const record = (extra: Partial<HistoryRecord>): HistoryRecord => ({ ...base, ...extra });
  const alice = { userObjectId: "acc-a", playerObjectId: "pa" }, bob = { userObjectId: "acc-b", playerObjectId: "pb" };

  test("у новых записей есть владелец: чужие игры не показываются; у старых общих записей владелец узнаётся по игроку за столом", () => {
    const rooms = [
      record({ owner: "acc-a", title: "Алисы" }),
      record({ owner: "acc-b", title: "Боба" }),
      record({ owner: undefined, playersData: { pa: { role: 1 }, px: { role: 2 } }, title: "Старая с Алисой" }),
      record({ owner: undefined, playersData: { px: { role: 2 } }, title: "Старая без обоих" })
    ];
    expect(ownRecords(rooms, alice).map(r => r.title)).toEqual(["Алисы", "Старая с Алисой"]);
    expect(ownRecords(rooms, bob).map(r => r.title)).toEqual(["Боба"]);
    expect(belongsTo(rooms[2]!, { userObjectId: "acc-a", playerObjectId: "" })).toBe(false);   // игрок неизвестен: старую запись не угадать
  });

  test("запись, присланная другому игроку, без привязки к аккаунту; ник и игрок владельца остаются", () => {
    const shared = sharedForm(record({ owner: "acc-a", me: { playerObjectId: "pa", username: "Алиса" } }));
    expect(shared.owner).toBeUndefined();
    expect(shared.me).toEqual({ playerObjectId: "pa", username: "Алиса" });
    expect(JSON.stringify(shared)).not.toContain("acc-a");
  });

  test("чужая запись очищается: me берётся только нужного вида, owner из неё никогда не приходит", () => {
    const clean = sanitizeRecord({ ...valid, owner: "чужой-аккаунт", me: { playerObjectId: "pz", username: "Z".repeat(100) } })!;
    expect(clean.owner).toBeUndefined();
    expect(clean.me).toEqual({ playerObjectId: "pz", username: "Z".repeat(32) });
    expect(sanitizeRecord({ ...valid, me: { playerObjectId: 5, username: "x" } })!.me).toBeUndefined();
    expect(sanitizeRecord({ ...valid, me: "строка" })!.me).toBeUndefined();
  });

  test("предел в 100 игр считается у каждого аккаунта отдельно: игры одного не вытесняют игры другого", () => {
    let rooms: HistoryRecord[] = [];
    for(let i = 0; i < HISTORY_LIMIT; i++) rooms = withRecord(rooms, record({ owner: "acc-b", createdAt: i }));
    for(let i = 0; i < HISTORY_LIMIT + 5; i++) rooms = withRecord(rooms, record({ owner: "acc-a", createdAt: 1000 + i }));
    expect(rooms.filter(r => r.owner == "acc-b")).toHaveLength(HISTORY_LIMIT);
    expect(rooms.filter(r => r.owner == "acc-a")).toHaveLength(HISTORY_LIMIT);
    expect(rooms[0]!.createdAt).toBe(1000 + HISTORY_LIMIT + 4);        // новая игра первой
    expect(rooms.filter(r => r.owner == "acc-a").at(-1)!.createdAt).toBe(1005);   // самые старые Алисы ушли, а не Боба
  });
});

