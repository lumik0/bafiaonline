import { describe, expect, test } from "bun:test";
import { generateAuthorKey, keyId, parseSignature, signMod, verifyMod } from "./signing";

const manifest = { id: "my-mod", version: "1.0.0", author: "Euaek" };

describe("подпись автора мода", () => {
  test("подписанный мод проверяется; изменение кода, версии, id и автора ломает подпись", async() => {
    const key = await generateAuthorKey();
    const signature = await signMod(manifest, "console.log(1)", key);
    expect(signature.key).toBe(key.publicKey);
    expect(await verifyMod(manifest, "console.log(1)", signature)).toBe(true);
    expect(await verifyMod(manifest, "console.log(2)", signature)).toBe(false);
    expect(await verifyMod({ ...manifest, version: "1.0.1" }, "console.log(1)", signature)).toBe(false);
    expect(await verifyMod({ ...manifest, id: "other-mod" }, "console.log(1)", signature)).toBe(false);
    expect(await verifyMod({ ...manifest, author: "Другой" }, "console.log(1)", signature)).toBe(false);
  });

  test("чужой ключ не подходит: подпись одного автора не признаётся от имени другого; мусор - просто «нет»", async() => {
    const mine = await generateAuthorKey(), other = await generateAuthorKey();
    const signature = await signMod(manifest, "код", mine);
    expect(await verifyMod(manifest, "код", { ...signature, key: other.publicKey })).toBe(false);
    expect(await verifyMod(manifest, "код", { key: "не ключ", value: "!!!" })).toBe(false);
    expect(await verifyMod(manifest, "код", { key: signature.key, value: "AAAA" })).toBe(false);
  });

  test("отпечаток ключа короткий и стабильный, у разных ключей разный", async() => {
    const a = await generateAuthorKey(), b = await generateAuthorKey();
    expect(await keyId(a.publicKey)).toMatch(/^[0-9a-f]{16}$/);
    expect(await keyId(a.publicKey)).toBe(await keyId(a.publicKey));
    expect(await keyId(a.publicKey)).not.toBe(await keyId(b.publicKey));
  });

  test("подпись из файла: только нужной формы", () => {
    expect(parseSignature({ key: "QUJD", value: "REVG" })).toEqual({ key: "QUJD", value: "REVG" });
    expect(parseSignature(undefined)).toBeUndefined();
    expect(parseSignature({ key: 5, value: "AA" })).toBeUndefined();
    expect(parseSignature({ key: "<script>", value: "AA" })).toBeUndefined();
    expect(parseSignature({ key: "A".repeat(300), value: "AA" })).toBeUndefined();
  });
});
