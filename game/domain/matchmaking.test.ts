import { describe, expect, test } from "bun:test";
import { Connection, ServerClient } from "@common/net";
import { createFakeNetwork, instantDelay } from "@common/net/testing";
import { Matchmaking, type MatchBan, type MatchRoom } from "./matchmaking";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

async function setup() {
  const network = createFakeNetwork();
  const client = new ServerClient(new Connection({ url: "ws://test", createSocket: () => network.createSocket(), delay: instantDelay }));
  client.session = { userObjectId: "uo1", token: "token" };
  client.connect();
  await tick();
  const match = new Matchmaking(client);
  match.start();
  const push = async(packet: Record<string, unknown>) => { network.last.receive(packet); await tick(); };
  const sentTypes = () => network.last.sent.map(packet => packet.ty);
  return { network, match, push, sentTypes };
}

describe("Matchmaking", () => {
  test("старт запрашивает статус и онлайн, ответ переводит в ожидание", async() => {
    const { match, push, sentTypes } = await setup();
    expect(sentTypes()).toEqual(["mmgsk", "mmguiabk"]);
    expect(match.state.phase).toBe("loading");

    await push({ ty: "mmuiabk", mmuiabk: 42 });
    await push({ ty: "mmms", mmms: {} });
    expect(match.state).toMatchObject({ phase: "idle", online: 42, canReturn: false });
    match.stop();
  });

  test("поиск → найдено → принять → выбор ролей → комната", async() => {
    const { match, push, sentTypes } = await setup();
    const rooms: MatchRoom[] = [];
    match.on("room", room => { rooms.push(room); });
    await push({ ty: "mmms", mmms: {} });

    match.search();
    expect(match.state.phase).toBe("searching");
    await push({ ty: "mmfun", mmfun: 7 });
    expect(match.state.found).toBe(7);

    await push({ ty: "mmag", mmlt: 20, mmagua: 3 });
    expect(match.state).toMatchObject({ phase: "accepting", secondsLeft: 20, accepted: 3 });
    match.accept();
    match.accept();
    expect(sentTypes().filter(ty => ty == "mmag")).toHaveLength(1);
    await push({ ty: "mmagu", mmagua: 9 });
    expect(match.state.accepted).toBe(9);

    await push({ ty: "mmsr", mmlt: 30 });
    expect(match.state.phase).toBe("roles");
    await push({ ty: "mmrc", mmrc: { "6": 2, "9": 12 } });
    expect(match.state.roleCounts).toEqual({ 6: 2, 9: 12 });

    match.toggleRole(6, false);
    expect(match.state.selectedRoles).not.toContain(6);
    match.toggleRole(6, true);
    expect(match.state.selectedRoles).toContain(6);
    expect(sentTypes().slice(-2)).toEqual(["mmusr", "mmsr"]);

    await push({ ty: "mmrr", rr: { o: "room1", sr: [6, 9] } });
    expect(rooms).toEqual([{ id: "room1", roles: [6, 9] }]);
    expect(sentTypes().at(-1)).toBe("mmruk");
    match.stop();
  });

  test("отмена поиска возвращает в ожидание", async() => {
    const { match, push, sentTypes } = await setup();
    await push({ ty: "mmms", mmms: {} });
    match.search();
    match.cancelSearch();
    expect(match.state.phase).toBe("idle");
    expect(sentTypes().slice(-3)).toEqual(["mmauk", "mmruk", "mmguiabk"]);
    match.stop();
  });

  test("незаконченная игра: можно вернуться; блокировка поиска сообщается", async() => {
    const { match, push, sentTypes } = await setup();
    const bans: MatchBan[] = [];
    match.on("banned", ban => { bans.push(ban); });
    await push({ ty: "mmms", mmms: { mmuir: true } });
    expect(match.state.canReturn).toBe(true);
    match.returnToGame();
    expect(sentTypes().at(-1)).toBe("mmrtr");

    match.search();
    await push({ ty: "mmib", mmbt: 1, mmbut: 600 });
    expect(bans).toEqual([{ reason: 1, seconds: 600 }]);
    expect(match.state.phase).toBe("idle");
    match.stop();
  });

  test("после stop пакеты игнорируются", async() => {
    const { match, push } = await setup();
    match.stop();
    await push({ ty: "mmuiabk", mmuiabk: 5 });
    expect(match.state.online).toBe(0);
  });

  test("главный экран (разобрано по apk): пьедестал, энергия с таймером, mmuir=false - вернуться нельзя", async() => {
    const { match, push } = await setup();
    await push({ ty: "mmms", mmms: {
      mmuir: false,
      rul: [{ puo: "p1", u: "Ухти", rv: 5, on: 1 }, { puo: "p2", u: "Мила", rv: 3 }, { puo: "p3", u: "Аксл", rv: 1 }, { puo: "p4", u: "Четвёртый", rv: 0 }, { u: "без id" }],
      ue: { ucea: 3, umfea: 5, ueaft: 2, ueant: 600 }
    } });

    expect(match.state.canReturn).toBe(false);
    expect(match.state.podium.map(user => [user.username, user.value, user.isOnline])).toEqual([["Ухти", 5, true], ["Мила", 3, false], ["Аксл", 1, false]]);
    expect(match.state.energy).toEqual({ current: 3, maxFree: 5, nextIn: 2, interval: 600 });

    // через 2 секунды прибавляется единица, таймер идёт заново
    await new Promise(resolve => setTimeout(resolve, 2300));
    expect(match.state.energy).toMatchObject({ current: 4, nextIn: 600 });
    match.stop();
  });

  test("события поиска: приняли, остановлен, не приняли, нет энергии, мало уровня", async() => {
    const { match, push } = await setup();
    const notices: string[] = [];
    match.on("notice", text => { notices.push(text); });
    await push({ ty: "mmms", mmms: {} });

    match.search();
    await push({ ty: "mmag", mmlt: 20, mmagua: 1, mmbpa: 12 });
    await push({ ty: "mmcuag" });
    expect(match.state.acceptedByMe).toBe(true);

    await push({ ty: "mmunag" });
    expect(match.state.phase).toBe("idle");
    match.search();
    await push({ ty: "mmss" });
    expect(match.state.phase).toBe("idle");

    match.search();
    await push({ ty: "mmneue" });
    match.search();
    await push({ ty: "nelfmm", data: "5" });
    expect(notices.map(text => text.slice(0, 20))).toEqual(["Игра не найдена: кто", "Недостаточно энергии", "Чтобы играть в сорев"]);
    expect(notices[2]).toContain("не ниже 5");
    match.stop();
  });
});
