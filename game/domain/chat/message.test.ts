import { describe, expect, test } from "bun:test";
import { applyBarmanEffect, colorToken, expandMentionNumber, MessageList, parseText, stableRows, toEntry, toRows, toggleMention, type ChatEntry } from "./message";

const entry = (partial: Partial<ChatEntry> & { text: string }): ChatEntry => ({ id: Math.random(), kind: "message", ...partial });
const user = (username: string) => ({ username });

describe("разбор сообщений", () => {
  test("смайлики и упоминания выделяются, HTML остаётся текстом", () => {
    expect(parseText("привет [Euaek] :sm1: <b>x</b>", "Euaek")).toEqual([
      { kind: "text", text: "привет " },
      { kind: "mention", text: "[Euaek]", mine: true },
      { kind: "text", text: " " },
      { kind: "emoji", name: "sm1" },
      { kind: "text", text: " <b>x</b>" }
    ]);
    expect(parseText("[Другой]", "Euaek")[0]).toMatchObject({ kind: "mention", mine: false });
    expect(parseText("[hist:abcdefghij12]")).toEqual([{ kind: "hist", id: "abcdefghij12" }]);
    expect(parseText("[hist:коротко]")[0]).toMatchObject({ kind: "mention" });
    expect(parseText("смотри [gif:abc_1]")).toEqual([{ kind: "text", text: "смотри " }, { kind: "gif", id: "abc_1" }]);
    expect(parseText(":sm9: []")).toEqual([{ kind: "text", text: ":sm9: []" }]);
  });

  test("вход и выход - отдельные виды, остальные с игроком - сообщения, без игрока - системные", () => {
    expect(toEntry({ type: 2, user: { username: "A" } }).kind).toBe("join");
    expect(toEntry({ type: 3, user: { username: "A" } }).kind).toBe("leave");
    expect(toEntry({ text: "ку", user: { username: "A", vip: "👑" } })).toMatchObject({ kind: "message", user: { username: "A", vip: "👑" } });
    expect(toEntry({ text: "Началась игра", type: 4 }).kind).toBe("system");
  });
});

describe("MessageList", () => {
  test("повторные «вошёл/вышел» одного игрока заменяют предыдущие", () => {
    const list = new MessageList();
    list.add(entry({ kind: "join", text: "", user: user("A") }));
    list.add(entry({ kind: "message", text: "привет", user: user("A") }));
    list.add(entry({ kind: "leave", text: "", user: user("A") }));
    list.add(entry({ kind: "join", text: "", user: user("B") }));

    expect(list.entries.map(e => `${e.kind}:${e.user?.username}`)).toEqual(["message:A", "leave:A", "join:B"]);
  });

  test("хранит не больше max последних", () => {
    const list = new MessageList(3);
    for(let i = 0; i < 5; i++) list.add(entry({ text: String(i), user: user("A") }));
    expect(list.entries.map(e => e.text)).toEqual(["2", "3", "4"]);
  });
});

describe("группировка", () => {
  test("подряд идущие сообщения одного игрока - одна группа; системная строка разрывает", () => {
    const rows = toRows([
      entry({ text: "1", user: user("A") }), entry({ text: "2", user: user("A") }),
      entry({ text: "3", user: user("B") }),
      entry({ kind: "system", text: "ночь" }),
      entry({ text: "4", user: user("B") })
    ]);

    expect(rows.map(row => row.type == "group" ? `${row.group.user.username}:${row.group.entries.length}` : "line")).toEqual(["A:2", "B:1", "line", "B:1"]);
  });

  test("при новом сообщении неизменившиеся строки остаются теми же объектами", () => {
    const a1 = entry({ text: "1", user: user("A") }), b1 = entry({ text: "2", user: user("B") });
    const first = toRows([a1, b1]);
    const a2 = entry({ text: "3", user: user("B") });

    const second = stableRows(first, toRows([a1, b1, a2]));
    expect(second[0]).toBe(first[0]);     // группа A не тронута
    expect(second[1]).not.toBe(first[1]); // группа B выросла: перерисуется только она
    expect(second).toHaveLength(2);
  });

  test("цвет по типу сообщения", () => {
    expect(colorToken(undefined)).toBe("chat-text");
    expect(colorToken(10)).toBe("chat-vote");
    expect(colorToken(28)).toBe("chat-giveup");
  });
});

describe("ввод", () => {
  test("опьянение: заменяет всё после первого символа на знаки и не трогает остальные сообщения", () => {
    expect(applyBarmanEffect("привет", "!", () => 0)).toBe("привет");
    expect(applyBarmanEffect("!абв", "!", () => 0)).toBe("???");
    expect(applyBarmanEffect("!", "!", () => 0)).toBe("");
    expect(applyBarmanEffect("!абв", "", () => 0)).toBe("!абв");
  });

  test("«@3 » превращается в упоминание игрока №3, неизвестный номер не трогается", () => {
    const names = ["Аня", "Боря", "Витя"];
    const lookup = (n: number) => names[n - 1];
    expect(expandMentionNumber("@3 ", lookup)).toBe("[Витя] ");
    expect(expandMentionNumber("привет @2 ", lookup)).toBe("привет [Боря] ");
    expect(expandMentionNumber("@9 ", lookup)).toBeUndefined();
    expect(expandMentionNumber("@3", lookup)).toBeUndefined();       // пока без пробела
    expect(expandMentionNumber("почта a@3 ", lookup)).toBeUndefined();
  });

  test("клик по нику вставляет упоминание с нужными пробелами и убирает повторным кликом", () => {
    expect(toggleMention("", 0, "Ник")).toEqual({ value: "[Ник] ", caret: 6 });
    expect(toggleMention("привет", 6, "Ник")).toEqual({ value: "привет [Ник] ", caret: 13 });
    expect(toggleMention("привет ", 7, "Ник")).toEqual({ value: "привет [Ник] ", caret: 13 });
    expect(toggleMention("[Ник] привет", 0, "Ник").value).toBe("привет");
    expect(toggleMention("привет [Ник] пока", 7, "Ник").value).toBe("привет пока");
    expect(toggleMention("привет [Ник]", 6, "Ник").value).toBe("привет");
  });
});
