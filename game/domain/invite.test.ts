import { describe, expect, test } from "bun:test";
import { inviteFromSearch, inviteUrl } from "./invite";

describe("ссылка-приглашение", () => {
  test("ссылка собирается из адреса игры и номера комнаты, без лишних параметров", () => {
    expect(inviteUrl("abc123", { origin: "https://lumik0.github.io", pathname: "/bafiaonline/play.html" })).toBe("https://lumik0.github.io/bafiaonline/play.html?room=abc123");
    expect(inviteUrl("a b&c", { origin: "http://localhost:8080", pathname: "/" })).toBe("http://localhost:8080/?room=a%20b%26c");
  });

  test("номер комнаты берётся только из нормального параметра room", () => {
    expect(inviteFromSearch("?room=abc123")).toBe("abc123");
    expect(inviteFromSearch("?server=ws://x&room=r-1_2")).toBe("r-1_2");
    expect(inviteFromSearch("")).toBeUndefined();
    expect(inviteFromSearch("?room=")).toBeUndefined();
    expect(inviteFromSearch("?room=<script>")).toBeUndefined();
    expect(inviteFromSearch("?room=" + "a".repeat(65))).toBeUndefined();
  });
});
