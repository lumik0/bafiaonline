import { describe, expect, test } from "bun:test";
import { digestHex, randomId, softwareDigest } from "./digest";

const bytes = (text: string) => new TextEncoder().encode(text);

describe("хеши без системного crypto (проверка с телефона по http)", () => {
  const vectors: [string, string, string][] = [
    ["", "da39a3ee5e6b4b0d3255bfef95601890afd80709", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "a9993e364706816aba3e25717850c26c9cd0d89d", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    ["abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", "84983e441c3bd26ebaae4aa1f95129e5e54670f1", "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"],
    ["Привет, мир! ".repeat(50), "", ""]
  ];

  test("SHA-1 и SHA-256 дают те же значения, что и системные, на коротких и длинных данных", async() => {
    for(const [text, sha1, sha256] of vectors) {
      const data = bytes(text);
      expect(softwareDigest["SHA-1"](data)).toBe(sha1 || await digestHex(data, "SHA-1"));
      expect(softwareDigest["SHA-256"](data)).toBe(sha256 || await digestHex(data, "SHA-256"));
    }
    // граничные длины блока (55, 56, 63, 64, 65 байт)
    for(const length of [55, 56, 63, 64, 65, 1000]) {
      const data = new Uint8Array(length).map((_, i) => i * 7);
      expect(softwareDigest["SHA-1"](data)).toBe(await digestHex(data, "SHA-1"));
      expect(softwareDigest["SHA-256"](data)).toBe(await digestHex(data, "SHA-256"));
    }
  });

  test("случайный id без randomUUID похож на uuid и не повторяется", () => {
    const original = crypto.randomUUID;
    // @ts-expect-error имитируем небезопасный контекст
    crypto.randomUUID = undefined;
    try {
      const a = randomId(), b = randomId();
      expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(a).not.toBe(b);
    } finally {
      crypto.randomUUID = original;
    }
  });
});
