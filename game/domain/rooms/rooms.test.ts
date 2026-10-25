import { describe, expect, test } from "bun:test";
import { Connection, ServerClient } from "@common/net";
import { createFakeNetwork, instantDelay } from "@common/net/testing";
import { MemoryFileStore } from "@common/storage";
import { md5salt } from "@common/utils/md5";
import { defaultFilter, filterDocument, matchesRoom } from "./filter";
import { defaultSortRules, normalizeSortRules, orderRooms, sortCriteria, sortRooms, sortRoles, toRoom, type RoomItem, type SortKey, type SortRule } from "./room";
import { RoomsList } from "./rooms";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const room = (partial: Partial<RoomItem> = {}): RoomItem => ({
  id: "r1", title: "Тестовая", minLevel: 1, minPlayers: 5, maxPlayers: 8, roles: [2], hasPassword: false, vip: false,
  friendsInRoom: 0, playersNum: 3, status: 0, myStatus: 2, ...partial
});

describe("комнаты", () => {
  test("из пакета сервера; без id комната отбрасывается; пароль и VIP приводятся к булевым", () => {
    expect(toRoom({ title: "x" })).toBeUndefined();
    expect(toRoom({ id: "r1", title: "Моя", password: "hash", vip: true, playersNum: 4, status: 0, roles: [2, 9] })).toMatchObject({ id: "r1", hasPassword: true, vip: true, playersNum: 4 });
    expect(toRoom({ id: "r2", password: "" })?.hasPassword).toBe(false);
  });

  test("порядок: сначала где вы играете, потом по статусу и уровню; роли в порядке карточки", () => {
    const sorted = sortRooms([room({ id: "a", minLevel: 5 }), room({ id: "b", myStatus: 0 }), room({ id: "c", status: 3 }), room({ id: "d", minLevel: 1 })]);
    expect(sorted.map(r => r.id)).toEqual(["b", "d", "a", "c"]);
    expect(sortRoles([8, 2, 11, 7])).toEqual([2, 7, 11, 8]);
  });
});

describe("сортировка списка комнат", () => {
  const list = [
    room({ id: "a", title: "Бета", playersNum: 3, maxPlayers: 8, minLevel: 5, friendsInRoom: 0 }),
    room({ id: "b", title: "альфа", playersNum: 7, maxPlayers: 8, minLevel: 1, friendsInRoom: 2, vip: true }),
    room({ id: "c", title: "Гамма", playersNum: 5, maxPlayers: 21, minLevel: 9, friendsInRoom: 2, hasPassword: true }),
    room({ id: "me", title: "Моя", playersNum: 1, maxPlayers: 8, minLevel: 11, myStatus: 0 })
  ];
  /** включает только перечисленные критерии (в этом порядке); `down` - те, что по убыванию */
  const rules = (...keys: [SortKey, boolean?][]) => [...keys.map(([key, desc]): SortRule => ({ key, on: true, desc: desc ?? sortCriteria[key].desc })), ...defaultSortRules().filter(rule => !keys.some(([key]) => key == rule.key)).map(rule => ({ ...rule, on: false }))];
  const ids = (...keys: [SortKey, boolean?][]) => orderRooms(list, rules(...keys)).map(r => r.id);

  test("обычный порядок без правил совпадает со старым; комната, где вы играете, всегда сверху", () => {
    expect(orderRooms(list, defaultSortRules()).map(r => r.id)).toEqual(["me", "b", "a", "c"]);
    expect(ids()).toEqual(["me", "b", "a", "c"]);
  });

  test("каждый критерий и его направление", () => {
    expect(ids(["players"])).toEqual(["me", "b", "c", "a"]);
    expect(ids(["players", false])).toEqual(["me", "a", "c", "b"]);
    expect(ids(["free"])).toEqual(["me", "c", "a", "b"]);
    expect(ids(["level", true])).toEqual(["me", "c", "a", "b"]);
    expect(ids(["title"])).toEqual(["me", "b", "a", "c"]);
    expect(ids(["vip"])).toEqual(["me", "b", "a", "c"]);
    expect(ids(["password"])).toEqual(["me", "b", "a", "c"]);
    expect(ids(["password", true])).toEqual(["me", "c", "b", "a"]);
  });

  test("приоритет: при равенстве первого критерия решает второй", () => {
    // у b и c по 2 друга: между ними решает число игроков; a без друзей - ниже
    expect(ids(["friends"], ["players"])).toEqual(["me", "b", "c", "a"]);
    expect(ids(["friends"], ["players", false])).toEqual(["me", "c", "b", "a"]);
    expect(ids(["players", false], ["friends"])).toEqual(["me", "a", "c", "b"]);
  });

  test("исходный список не меняется", () => {
    const before = list.map(r => r.id);
    orderRooms(list, rules(["players"]));
    expect(list.map(r => r.id)).toEqual(before);
  });

  test("сохранённые правила приводятся в порядок: мусор уходит, недостающее добавляется, повторов нет", () => {
    expect(normalizeSortRules(undefined)).toEqual(defaultSortRules());
    const fixed = normalizeSortRules([{ key: "players", on: true, desc: false }, { key: "players", on: true }, { key: "нет", on: true }, 5, { key: "title" }]);
    expect(fixed.map(rule => rule.key)).toEqual(["players", "title", "friends", "status", "level", "free", "vip", "password"]);
    expect(fixed[0]).toEqual({ key: "players", on: true, desc: false });
    expect(fixed[1]).toEqual({ key: "title", on: false, desc: false });
  });

  test("правила сохраняются в файле фильтра", async() => {
    const files = new MemoryFileStore();
    const doc = filterDocument(files);
    const saved = rules(["friends"], ["level"]);
    await doc.write({ ...defaultFilter(), sortRules: saved });
    expect((await doc.read()).sortRules).toEqual(saved);
    await files.write("/game/filter.json", JSON.stringify({ sortRules: "что-то" }));
    expect((await doc.read()).sortRules).toEqual(defaultSortRules());
  });
});

describe("фильтр комнат", () => {
  const filter = { ...defaultFilter(), enabled: true };

  test("поиск по названию работает и при выключенном фильтре", () => {
    expect(matchesRoom(room(), defaultFilter(), "тест")).toBe(true);
    expect(matchesRoom(room(), defaultFilter(), "другое")).toBe(false);
  });

  test("условия фильтра", () => {
    expect(matchesRoom(room(), filter)).toBe(true);
    expect(matchesRoom(room({ status: 0 }), { ...filter, isRegistration: false })).toBe(false);
    expect(matchesRoom(room({ minLevel: 12 }), filter)).toBe(false);
    expect(matchesRoom(room({ maxPlayers: 22 }), filter)).toBe(false);
    expect(matchesRoom(room({ hasPassword: true }), { ...filter, withoutPassword: true })).toBe(false);
    expect(matchesRoom(room({ hasPassword: false }), { ...filter, withPassword: true })).toBe(false);
    expect(matchesRoom(room({ vip: true }), { ...filter, withoutVip: true })).toBe(false);
    expect(matchesRoom(room({ friendsInRoom: 0 }), { ...filter, friends: true })).toBe(false);
    expect(matchesRoom(room({ friendsInRoom: 2 }), { ...filter, friends: true })).toBe(true);
  });

  test("роли: нужна хотя бы одна из выбранных; «без этих ролей» - наоборот", () => {
    expect(matchesRoom(room({ roles: [] }), filter)).toBe(false);
    expect(matchesRoom(room({ roles: [] }), { ...filter, noRoles: true })).toBe(true);
    expect(matchesRoom(room({ roles: [2] }), { ...filter, noRoles: true })).toBe(false);
  });

  test("файл фильтра старой версии читается, мусор заменяется значениями по умолчанию", async() => {
    const files = new MemoryFileStore();
    await files.write("/game/filter.json", JSON.stringify({ version: 1, enabled: true, minPl: "много", maxPl: 10, roles: [2, "x", 5] }));
    const filter = await filterDocument(files).read();
    expect(filter).toMatchObject({ enabled: true, minPl: 5, maxPl: 10, roles: [2, 5] });
  });
});

async function setup() {
  const network = createFakeNetwork();
  const client = new ServerClient(new Connection({ url: "ws://test", createSocket: () => network.createSocket(), delay: instantDelay }));
  client.session = { userObjectId: "uo1", token: "t" };
  client.connect();
  await tick();
  return { network, client, list: new RoomsList(client) };
}

describe("RoomsList", () => {
  test("список приходит целиком, дальше обновляется событиями", async() => {
    const { network, list } = await setup();
    list.open();
    expect(network.last.sent[0]).toEqual({ ty: "acrl", uo: "uo1", t: "t" });

    network.last.receive({ ty: "rs", rs: [{ o: "a", tt: "Первая", mnl: 5, pn: 3, s: 0 }, { o: "b", tt: "Вторая", mnl: 1, pn: 2, s: 0 }] });
    expect(list.rooms.map(r => r.id)).toEqual(["b", "a"]);

    network.last.receive({ ty: "add", rr: { o: "c", tt: "Новая", mnl: 1, s: 0 } });
    network.last.receive({ ty: "rils", rils: { ro: "a", pin: "6" } });
    network.last.receive({ ty: "gsrl", ro: "b", s: 3 });
    network.last.receive({ ty: "rm", ro: "c" });

    expect(list.rooms.find(r => r.id == "a")?.playersNum).toBe(6);
    expect(list.rooms.find(r => r.id == "b")?.status).toBe(3);
    expect(list.rooms.map(r => r.id)).not.toContain("c");

    list.close();
    network.last.receive({ ty: "add", rr: { o: "z", tt: "после закрытия" } });
    expect(list.rooms.map(r => r.id)).not.toContain("z");
  });

  test("вход: пароль уходит хешем, ответы сервера превращаются в понятные результаты", async() => {
    const { network, list } = await setup();
    network.respond = (packet, socket) => socket.receive(packet.psw == md5salt("тайна") ? { ty: "re", rr: { o: "r1" } } : { ty: "rpiw" });

    expect(await list.join("r1", "неверно")).toEqual({ status: "wrongPassword" });
    expect(await list.join("r1", "тайна")).toMatchObject({ status: "ok", roomId: "r1" });
    expect(network.last.sent.at(-1)).toMatchObject({ ty: "re", ro: "r1", psw: md5salt("тайна") });

    for(const [ty, status] of [["gsd", "started"], ["uiar", "anotherRoom"], ["uuda", "doubleAccount"], ["ulne", "levelTooLow"], ["ukd", "kicked"], ["mxmp", "full"], ["uinv", "notVip"]] as const) {
      network.respond = (_, socket) => socket.receive({ ty });
      expect(await list.join("r1")).toEqual({ status });
    }
  });

  test("создание комнаты: пароль хешируется, можно получить статистику вместо подтверждения", async() => {
    const { network, list } = await setup();
    network.respond = (_, socket) => socket.receive({ ty: "rst", rst: { ms: [] } });

    const result = await list.create({ title: "Новая", minPlayers: 5, maxPlayers: 8, minLevel: 1, selectedRoles: [2], password: "пароль", vip: false });

    expect(result.status).toBe("ok");
    expect(network.last.sent.at(-1)).toMatchObject({ ty: "rc", rr: { tt: "Новая", pw: md5salt("пароль"), mxp: 8, sr: [2], venb: false } });
  });

  test("ожидание места: сообщает число игроков и заканчивается, когда остаётся одно место", async() => {
    const { network, list } = await setup();
    const seen: number[] = [];
    const waiting = list.waitForSlot(room({ id: "r1", maxPlayers: 8 }), players => seen.push(players));

    network.last.receive({ ty: "rils", rils: { ro: "r1", pin: 5 } });
    network.last.receive({ ty: "rils", rils: { ro: "другая", pin: 7 } });
    network.last.receive({ ty: "rils", rils: { ro: "r1", pin: 7 } });

    expect(await waiting.done).toBe("slot");
    expect(seen).toEqual([5, 7]);

    const second = list.waitForSlot(room({ id: "r2" }), () => {});
    network.last.receive({ ty: "gsrl", ro: "r2", s: 2 });
    expect(await second.done).toBe("started");

    const third = list.waitForSlot(room({ id: "r3" }), () => {});
    third.cancel();
    expect(await third.done).toBe("cancelled");
  });
});
