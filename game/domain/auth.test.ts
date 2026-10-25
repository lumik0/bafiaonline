import "fake-indexeddb/auto";
import { describe, expect, test } from "bun:test";
import { Connection, ServerClient } from "@common/net";
import { createFakeNetwork, instantDelay, type FakeSocket } from "@common/net/testing";
import { createStorage, MemoryFileStore } from "@common/storage";
import { md5salt } from "@common/utils/md5";
import { Auth } from "./auth";
import { User } from "./user";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

const signedIn = { ty: "usi", usid: { u: "Euaek", t: "session-token", o: "o1", uo: "uo1" } };
const dashboard = { ty: "db", db: { du: { u: "Euaek", puo: "p1", ph: "photo1", l: 11, ex: 100, nle: 200 }, uac: { gcns: 5, scns: 7 } } };

/** сервер, который отвечает как настоящий на вход и дашборд */
function serverReplies(packet: Record<string, any>, socket: FakeSocket) {
  if(packet.ty == "sin") socket.receive(packet.pw == md5salt("right") ? signedIn : { ty: "siner", e: -3 });
  if(packet.ty == "acd") socket.receive(dashboard);
}

async function setup() {
  const network = createFakeNetwork();
  network.respond = serverReplies;
  const client = new ServerClient(new Connection({ url: "ws://test", createSocket: () => network.createSocket(), delay: instantDelay }));
  const storage = createStorage(new MemoryFileStore());
  const user = new User();
  const auth = new Auth(client, storage.accounts, user);
  client.connect();
  await tick();
  return { network, client, storage, user, auth };
}

describe("Auth", () => {
  test("вход по паролю: пароль уходит хешем, профиль и аккаунт сохраняются", async() => {
    const { network, storage, user, auth, client } = await setup();

    const result = await auth.signIn({ email: "a@b.c", password: "right" });

    expect(result.status).toBe("ok");
    expect(network.last.sent[0]).toMatchObject({ ty: "sin", e: "a@b.c", pw: md5salt("right"), ds: "browser" });
    expect(network.last.sent[0]!.pw).not.toBe("right");
    expect(user).toMatchObject({ username: "Euaek", level: 11, goldCoins: 5, silverCoins: 7, userObjectId: "uo1" });
    expect(client.session).toEqual({ userObjectId: "uo1", token: "session-token" });
    expect(await storage.accounts.list()).toEqual([expect.objectContaining({ name: "Euaek", email: "a@b.c", userId: "uo1", token: "session-token", playerUserId: "p1" })]);
  });

  test("неверный пароль - ошибка с текстом, аккаунт не сохраняется", async() => {
    const { storage, auth, client } = await setup();

    const result = await auth.signIn({ email: "a@b.c", password: "wrong" });

    expect(result).toEqual({ status: "error", code: -3, message: "Неверный пароль" });
    expect(client.session).toBeUndefined();
    expect(await storage.accounts.list()).toEqual([]);
  });

  test("блокировка и неподтверждённая почта возвращаются как результат", async() => {
    const { network, auth } = await setup();
    network.respond = (_, socket) => socket.receive({ ty: "ublk", r: "спам", tsr: 60 });
    expect(await auth.signIn({ email: "a@b.c", password: "x" })).toEqual({ status: "blocked", reason: "спам", secondsRemaining: 60 });

    network.respond = (_, socket) => socket.receive({ ty: "env" });
    expect(await auth.signIn({ email: "a@b.c", password: "x" })).toEqual({ status: "emailNotVerified" });
  });

  test("после обрыва связи входит заново по почте и паролю", async() => {
    const { network, auth } = await setup();
    await auth.signIn({ email: "a@b.c", password: "right" });
    const reconnected = new Promise<boolean>(resolve => auth.on("signedIn", (_, again) => again && resolve(again)));

    network.last.drop();

    expect(await reconnected).toBe(true);
    expect(network.sockets).toHaveLength(2);
    expect(network.last.sent[0]).toMatchObject({ ty: "sin", e: "a@b.c", pw: md5salt("right") });
  });

  test("в комнате повторный вход не запрашивает дашборд и не меняет подписку; устройство то же", async() => {
    const { network, auth } = await setup();
    await auth.signIn({ email: "a@b.c", password: "right" });
    const firstDevice = network.last.sent[0]!.d;
    expect(firstDevice).toMatch(/^[0-9a-f]{16}$/);
    auth.keepSubscription = () => true;
    const reconnected = new Promise<boolean>(resolve => auth.on("signedIn", (_, again) => again && resolve(again)));

    network.last.drop();
    await reconnected;

    expect(network.last.sent.map(packet => packet.ty)).toEqual(["sin"]);
    expect(network.last.sent[0]!.d).toBe(firstDevice);
  });

  test("выход очищает сессию и больше не входит при переподключении", async() => {
    const { network, auth, client, user } = await setup();
    await auth.signIn({ email: "a@b.c", password: "right" });

    auth.signOut();
    network.last.drop();
    await tick();

    expect(client.session).toBeUndefined();
    expect(user.isSignedIn).toBe(false);
    expect(network.last.sent).toEqual([]);
  });
});
