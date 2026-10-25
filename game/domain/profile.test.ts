import { describe, expect, test } from "bun:test";
import { Connection, ServerClient } from "@common/net";
import { createFakeNetwork, instantDelay } from "@common/net/testing";
import { createStorage, MemoryFileStore } from "@common/storage";
import { ProfileService, sortDefaultPhotos } from "./profile";
import { User } from "./user";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

async function setup() {
  const network = createFakeNetwork();
  const client = new ServerClient(new Connection({ url: "ws://test", createSocket: () => network.createSocket(), delay: instantDelay }));
  const storage = createStorage(new MemoryFileStore());
  const user = new User();
  user.signIn("uo1", "token");
  user.applyDashboard({ user: { username: "Euaek", playerObjectId: "p1" } });
  client.session = { userObjectId: "uo1", token: "token" };
  await storage.accounts.upsert({ name: "", userId: "uo1", email: "a@b.c" });
  client.connect();
  await tick();
  return { network, client, storage, user, profile: new ProfileService(client, user, storage.accounts) };
}

describe("ProfileService", () => {
  test("ник: успех обновляет игрока и сохраняет имя в аккаунте", async() => {
    const { network, storage, user, profile } = await setup();
    network.respond = (packet, socket) => packet.ty == "uns" && socket.receive({ ty: "uns", u: "Новое" });

    expect(await profile.setUsername("Новое")).toEqual({ status: "ok", username: "Новое" });
    expect(network.last.sent[0]).toEqual({ ty: "uns", u: "Новое", uo: "uo1", t: "token" });
    expect(user.username).toBe("Новое");
    expect((await storage.accounts.list())[0]!.name).toBe("Новое");
  });

  test("ник: все причины отказа различаются", async() => {
    const { network, profile } = await setup();
    for(const [ty, status] of [["unws", "wrongSymbols"], ["unex", "exists"], ["unob", "outOfBounds"], ["unie", "empty"]] as const) {
      network.respond = (_, socket) => socket.receive({ ty });
      expect(await profile.setUsername("x")).toEqual({ status });
    }
  });

  test("фото: стандартные сортируются, выбор и загрузка обновляют игрока и аккаунт", async() => {
    expect(sortDefaultPhotos(["f2", "m10", "m2", "f1"])).toEqual(["m2", "m10", "f1", "f2"]);

    const { network, storage, user, profile } = await setup();
    network.respond = (packet, socket) => {
      if(packet.ty == "usgdph") socket.receive({ ty: "usdph", usdph: { usdphi: ["f1", "m1"] } });
      if(packet.ty == "ussdph") socket.receive({ ty: "ussdph" });
      if(packet.ty == "upp") socket.receive({ ty: "db", db: { du: { u: "Euaek", ph: "uploaded.jpg" } } });
    };

    expect(await profile.defaultPhotos()).toEqual(["m1", "f1"]);
    await profile.chooseDefaultPhoto("m1");
    expect(user.photo).toBe("m1");

    expect(await profile.uploadPhoto("BASE64")).toBe("ok");
    expect(user.photo).toBe("uploaded.jpg");
    expect((await storage.accounts.list())[0]!.photo).toBe("uploaded.jpg");
  });

  test("фото: неверный тип файла и удаление (ответ без дашборда возвращает фото по умолчанию)", async() => {
    const { network, user, profile } = await setup();
    network.respond = (_, socket) => socket.receive({ ty: "wft" });
    expect(await profile.uploadPhoto("X")).toBe("wrongType");

    network.respond = (_, socket) => socket.receive({ ty: "rph" });
    await profile.removePhoto();
    expect(user.photo).toBe("1");
  });

  test("язык сервера: слишком частая смена возвращает, через сколько секунд можно снова", async() => {
    const { network, profile } = await setup();
    network.respond = (_, socket) => socket.receive({ ty: "sslte", data: 7200 });
    expect(await profile.setServerLanguage("en")).toEqual({ status: "tooSoon", waitSeconds: 7200 });

    network.respond = (_, socket) => socket.receive({ ty: "slc" });
    expect(await profile.setServerLanguage("ru")).toEqual({ status: "ok" });
  });

  test("чужой профиль разбирается из пакета сервера; числа строкой допустимы", async() => {
    const { network, profile } = await setup();
    network.respond = (_, socket) => socket.receive({
      ty: "uup",
      uup: {
        pud: { u: "Игрок", puo: "p2", l: 12, ex: 10, nle: 100, on: true, prst: { "4": 5 }, pg: 20, wim: 3, wip: 4, s: 1 },
        uac: { scns: 500, gcns: 3 },
        fp: "friendship-id", fpf: "3"
      }
    });

    const data = await profile.loadProfile("p2");
    expect(data?.user).toMatchObject({ username: "Игрок", level: 12, isOnline: true, roleStatistics: { 4: 5 }, winsAsMafia: 3, sex: 1 });
    expect(data?.friendshipFlag).toBe(3);
    expect(data?.coins).toEqual({ silver: 500, gold: 3 });
  });

  test("профиль без ответа - undefined, а не вечное ожидание", async() => {
    const { profile } = await setup();
    expect(await profile.loadProfile("p2", 20)).toBeUndefined();
  });

  test("дружба: заявка и переполненный список", async() => {
    const { network, profile } = await setup();
    network.respond = (_, socket) => socket.receive({ ty: "af" });
    expect(await profile.addFriend("p2")).toEqual({ status: "ok" });

    network.respond = (_, socket) => socket.receive({ ty: "yflf", fll: 100 });
    expect(await profile.addFriend("p2")).toEqual({ status: "listFull", limit: 100 });

    network.respond = (_, socket) => socket.receive({ ty: "rf" });
    await profile.removeFriend("p2");
  });

  test("пол: пакет ucs без ответа, итог по перечитанному профилю; сервер не принял - false", async() => {
    const { network, profile } = await setup();
    let sex = 0;
    network.respond = (packet, socket) => {
      if(packet.ty == "ucs") sex = packet.s as number;
      if(packet.ty == "gup") socket.receive({ ty: "uup", uup: { pud: { u: "Euaek", puo: "p1", s: sex } } });
    };

    expect(await profile.mySex()).toBe(0);
    expect(await profile.setSex(1, async() => {})).toBe(true);
    expect(network.last.sent.find(packet => packet.ty == "ucs")).toEqual({ ty: "ucs", s: 1, uo: "uo1", t: "token" });

    // сервер молча отказал: пол остался прежним
    network.respond = (packet, socket) => { if(packet.ty == "gup") socket.receive({ ty: "uup", uup: { pud: { u: "Euaek", puo: "p1", s: 1 } } }); };
    expect(await profile.setSex(0, async() => {})).toBe(false);
  });
});
