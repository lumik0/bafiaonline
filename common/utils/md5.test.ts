import { expect, test } from "bun:test";
import { md5salt } from "./md5";

// значения посчитаны старой реализацией (legacy/core/src/utils/md5.ts): пароли игроков хешируются так же
test("md5salt совпадает со старой реализацией", () => {
  expect(md5salt("password")).toBe("047d730ef933fd9d9447b47ff89bccc2");
  expect(md5salt("a1")).toBe("174b123c89ce597d4c0831f7e20f2323");
  expect(md5salt("")).toBe("348c7617882bc238b36448f029da3ac2");
});
