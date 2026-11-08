import { describe, expect, test } from "bun:test";
import { canSubmitForReview, evaluateTrust, parseRegistry, trustText, type ModRegistry } from "./trust";

const HASH = "a".repeat(64), OTHER = "b".repeat(64), KEY = "0123456789abcdef", BAD_KEY = "fedcba9876543210";
const registry: ModRegistry = {
  approved: [HASH], blocked: [{ hash: OTHER, note: "вредный" }],
  authors: { trusted: [{ id: KEY, nick: "Автор" }], blocked: [{ id: BAD_KEY, note: "спам" }] }
};
const mod = (sha256: string, author = "Автор") => ({ manifest: { id: "x", name: "X", version: "1", author, permissions: [], domains: [] }, sha256 });

describe("доверие к модам", () => {
  test("порядок: встроенный, запрет версии, запрет автора, проверенная версия, доверенный автор, подпись, без подписи, подделка", () => {
    expect(evaluateTrust(mod("c".repeat(64)), undefined, registry, true)).toEqual({ level: "official" });
    expect(evaluateTrust(mod(OTHER), { valid: true, keyId: KEY }, registry, false)).toEqual({ level: "blocked", reason: "вредный" });          // запрет версии важнее доверия к автору
    expect(evaluateTrust(mod("c".repeat(64)), { valid: true, keyId: BAD_KEY }, registry, false)).toEqual({ level: "blocked", reason: "спам" });
    expect(evaluateTrust(mod(HASH), undefined, registry, false)).toEqual({ level: "verified" });
    expect(evaluateTrust(mod("c".repeat(64)), { valid: true, keyId: KEY }, registry, false)).toEqual({ level: "author", nick: "Автор" });
    expect(evaluateTrust(mod("c".repeat(64)), { valid: true, keyId: "1111111111111111" }, registry, false)).toEqual({ level: "signed", nick: "Автор" });
    expect(evaluateTrust(mod("c".repeat(64)), undefined, registry, false)).toEqual({ level: "unsigned" });
    expect(evaluateTrust(mod("c".repeat(64)), { valid: false, keyId: KEY }, registry, false)).toEqual({ level: "invalid" });
  });

  test("ключ доверенного автора закреплён за его ником; без списка с сервера моды просто не проверены, а не запрещены", () => {
    expect(evaluateTrust(mod("c".repeat(64), "Другой"), { valid: true, keyId: KEY }, registry, false)).toEqual({ level: "signed", nick: "Другой" });
    expect(evaluateTrust(mod("c".repeat(64), "автор"), { valid: true, keyId: KEY }, registry, false)).toMatchObject({ level: "author" });   // регистр ника не важен
    expect(evaluateTrust(mod(OTHER), { valid: true, keyId: KEY }, undefined, false)).toEqual({ level: "signed", nick: "Автор" });
    expect(evaluateTrust(mod(HASH), undefined, undefined, false)).toEqual({ level: "unsigned" });
  });

  test("список с сервера разбирается только по форме: мусор отбрасывается", () => {
    expect(parseRegistry(null)).toBeUndefined();
    expect(parseRegistry({ approved: [HASH, "плохо", 5], blocked: [{ hash: OTHER, note: "x".repeat(300) }, { hash: "нет" }], authors: { trusted: [{ id: KEY, nick: "А" }, { id: "x", nick: "Б" }], blocked: [{ id: BAD_KEY }] } })).toEqual({
      approved: [HASH], blocked: [{ hash: OTHER, note: "x".repeat(120) }], authors: { trusted: [{ id: KEY, nick: "А" }], blocked: [{ id: BAD_KEY, note: "" }] }
    });
    expect(parseRegistry({})).toEqual({ approved: [], blocked: [], authors: { trusted: [], blocked: [] } });
  });

  test("отправить на проверку может только подписавший автор с ником игрока и только пока мод не проверен", () => {
    const pack = { manifest: mod(HASH).manifest, signature: { key: "QUJD", value: "REVG" } };
    expect(canSubmitForReview(pack, { level: "signed", nick: "Автор" }, "автор")).toBe(true);
    expect(canSubmitForReview(pack, { level: "signed", nick: "Автор" }, "Чужой")).toBe(false);
    expect(canSubmitForReview(pack, { level: "unsigned" }, "Автор")).toBe(false);
    expect(canSubmitForReview(pack, { level: "verified" }, "Автор")).toBe(false);
    expect(canSubmitForReview(pack, { level: "author", nick: "Автор" }, "Автор")).toBe(false);
    expect(canSubmitForReview({ manifest: pack.manifest }, { level: "signed", nick: "Автор" }, "Автор")).toBe(false);
  });

  test("тексты для игрока понятны для каждого уровня", () => {
    expect(trustText({ level: "unsigned" })).toContain("на свой риск");
    expect(trustText({ level: "blocked", reason: "спам" })).toContain("Запрещён Бафией: спам");
    expect(trustText({ level: "author", nick: "Автор" })).toContain("«Автор» проверен");
  });
});
