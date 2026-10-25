import { describe, expect, test } from "bun:test";
import { decode, encode, ProtocolError } from ".";

const session = { userObjectId: "user-1", token: "secret" };

describe("encode", () => {
  test("подставляет userObjectId и token в пакеты с авторизацией", () => {
    expect(JSON.parse(encode("removePhoto", {}, session))).toEqual({ ty: "rph", uo: "user-1", t: "secret" });
  });

  test("не добавляет авторизацию туда, где её не было", () => {
    expect(JSON.parse(encode("enterRoom", { password: "", roomId: "r1" }))).toEqual({ ty: "re", psw: "", ro: "r1" });
  });

  test("без сессии пакет с авторизацией не отправляется", () => {
    expect(() => encode("removePhoto", {})).toThrow("требует авторизации");
  });

  test("вложенные объекты получают реальные ключи", () => {
    const wire = JSON.parse(encode("sendChatMessage", { message: { text: "привет", style: 0, sticker: false } }));
    expect(wire).toEqual({ ty: "cmc", m: { tx: "привет", mstl: 0, mstk: false } });
  });

  // проверяется компилятором (`bun check`), вызывать не нужно
  test("опечатки в именах и полях не компилируются", () => {
    const typeChecks = () => {
      // @ts-expect-error нет такого пакета
      encode("removePhotoo", {}, session);
      // @ts-expect-error roomId должен быть строкой
      encode("enterRoom", { password: "", roomId: 1 });
    };
    expect(typeChecks).toBeFunction();
  });
});

describe("decode", () => {
  test("приводит ключи пакета к читаемым именам", () => {
    const message = decode(JSON.stringify({ ty: "usi", usid: { u: "Euaek", t: "tok", o: "obj", uo: "uo-1" } }));
    expect(message.name).toBe("signedIn");
    if(message.name == "signedIn") expect(message.data.user).toEqual({ username: "Euaek", token: "tok", objectId: "obj", userObjectId: "uo-1" });
  });

  test("одинаковые ключи в разных пакетах не путаются: t - это token, а не секунды", () => {
    const timer = decode(JSON.stringify({ t: 12 }));
    expect(timer).toMatchObject({ name: "timer", data: { seconds: 12 } });
  });

  test("незнакомый пакет не ломает приём", () => {
    const message = decode(JSON.stringify({ ty: "something-new", x: 1 }));
    expect(message).toMatchObject({ name: "unknown", type: "something-new" });
  });

  test("известный пакет с неверной схемой - ProtocolError", () => {
    expect(() => decode(JSON.stringify({ ty: "siner", e: "oops" }))).toThrow(ProtocolError);
  });

  test("необязательные поля можно не присылать", () => {
    const message = decode(JSON.stringify({ ty: "ublk" }));
    expect(message).toMatchObject({ name: "userBlocked", data: {} });
  });
});
