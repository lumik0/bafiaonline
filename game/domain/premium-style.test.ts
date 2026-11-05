import { describe, expect, test } from "bun:test";
import { parseClientMessage, parseLook } from "@common/bafia/protocol";
import { avatarFrame, frameColor, nickEffect, themeBackground } from "./premium-style";

describe("внешний вид профиля", () => {
  test("parseLook оставляет только известные поля и чистит статус", () => {
    expect(parseLook({ status: "  привет  ", frame: "red", effect: "glow", theme: "ocean", pin: "g_1", evil: 1 })).toEqual({ status: "привет", frame: "red", effect: "glow", theme: "ocean", pin: "g_1" });
    expect(parseLook({ status: "x".repeat(61), frame: "pink!", effect: "boom", theme: "nope", pin: "../x" })).toEqual({});
    expect(parseLook({ status: "a\nb" })).toEqual({});
    expect(parseLook(null)).toEqual({});
  });

  test("рамка, эффект и тема дают стили; пустой вид ничего не меняет", () => {
    expect(frameColor({ frame: "red" })).toBe("#E5484D");
    expect(avatarFrame({ frame: "red" })).toContain("#E5484D");
    expect(avatarFrame({}, "fallback")).toBe("fallback");
    expect(nickEffect({ effect: "glow" }, "#112233")["text-shadow"]).toContain("#112233");
    expect(nickEffect({ effect: "rainbow" }, undefined).background).toContain("linear-gradient");
    expect(nickEffect({}, "#112233")).toEqual({});
    expect(themeBackground({ theme: "night" })).toMatchObject({ text: "#f2f2f2" });
    expect(themeBackground({ theme: "candy" })).toMatchObject({ text: "#121212" });
    expect(themeBackground({})).toBeUndefined();
  });

  test("запросы look, report и whoNicks разбираются, лишнее отбрасывается", () => {
    expect(parseClientMessage(JSON.stringify({ t: "look", n: 1, look: { status: "ок", junk: 1 } }))).toEqual({ t: "look", n: 1, look: { status: "ок" } });
    expect(parseClientMessage(JSON.stringify({ t: "report", n: 1, id: "p1", kind: "banner" }))).toMatchObject({ t: "report", kind: "banner" });
    expect(parseClientMessage(JSON.stringify({ t: "report", n: 1, id: "p1", kind: "gif" }))).toBeUndefined();
    expect(parseClientMessage(JSON.stringify({ t: "whoNicks", n: 1, nicks: ["a", "b"] }))).toMatchObject({ nicks: ["a", "b"] });
    expect(parseClientMessage(JSON.stringify({ t: "whoNicks", n: 1, nicks: Array(21).fill("a") }))).toBeUndefined();
    expect(parseClientMessage(JSON.stringify({ t: "whoNicks", n: 1, nicks: ["a", 5] }))).toBeUndefined();
  });
});
