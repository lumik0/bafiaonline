import { describe, expect, test } from "bun:test";
import { Connection, ServerClient } from "@common/net";
import { createFakeNetwork, instantDelay } from "@common/net/testing";
import { createStorage, MemoryFileStore } from "@common/storage";
import { decode } from "@common/protocol";
import { historyDocument, outcomeOf, type HistoryRecord } from "../history";
import { DocumentStore } from "../store";
import { SettingsStore } from "../settings";
import { roomSettings } from "../rooms/enter";
import { RoomSession } from "./session";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

async function setup(options: { clearMessages?: boolean, saveHistory?: boolean } = {}) {
  const network = createFakeNetwork();
  const client = new ServerClient(new Connection({ url: "ws://test", createSocket: () => network.createSocket(), delay: instantDelay }));
  client.session = { userObjectId: "uo1", token: "t" };
  client.connect();
  await tick();
  const files = new MemoryFileStore();
  const settings = await SettingsStore.load(createStorage(files).settings);
  settings.data.game.clearMessages = options.clearMessages ?? true;
  settings.data.game.saveHistory = options.saveHistory ?? true;
  const first = decode(JSON.stringify({ ty: "re", rr: { o: "r1", rmt: 1, tt: "Комната", mxp: 8, mnp: 5, mnl: 1, sr: [2], venb: false } }));
  const history = await DocumentStore.load(historyDocument(files));
  const deps = { client, history, settings, myPlayerObjectId: "p1" };
  const session = new RoomSession(deps, roomSettings("r1", first));
  return { network, files, session, first, deps, history };
}

const roster = (n: number) => Array.from({ length: n }, (_, i) => ({ o: `o${i + 1}`, pu: { puo: `p${i + 1}`, u: `Игрок${i + 1}` } }));

describe("RoomSession: роли", () => {
  test("пакет rls: мафия видит роли своих, а на живом сервере это единственный источник чужих ролей", async() => {
    const { network, session, first } = await setup();
    session.start(first);
    network.last.receive({ ty: "rst", rst: { gs: { s: 3, t: 5, d: 0 }, pls: roster(3), pd: [{ puo: "p1", a: true }] } });

    network.last.receive({ ty: "rls", rls: [{ puo: "p1", r: 4 }, { puo: "p2", r: 4 }] });

    expect(session.state.players.find(player => player.playerObjectId == "p2")?.role).toBe(4);
    expect(session.state.me?.role).toBe(4);
  });
});

describe("RoomSession: связь и отказы", () => {
  test("rejoin заново создаёт игрока в комнате, но не после конца игры и не после выхода", async() => {
    const { network, session, first } = await setup();
    session.start(first);
    network.last.sent.length = 0;

    session.rejoin();
    expect(network.last.sent).toEqual([{ ty: "cp", uo: "uo1", t: "t", ro: "r1", rmt: 1 }]);

    network.last.sent.length = 0;
    network.last.receive({ ty: "gs", gs: { s: 4, t: 0 } });
    session.rejoin();
    expect(network.last.sent).toEqual([]);
  });

  test("тебя выгнали и отказы кика доходят до экрана", async() => {
    const { network, session, first } = await setup();
    session.start(first);
    const ended: string[] = [];
    const notices: string[] = [];
    session.on("ended", reason => { ended.push(reason); });
    session.on("notice", text => { notices.push(text); });

    network.last.receive({ ty: "ukd" });
    network.last.receive({ ty: "kugs" });
    network.last.receive({ ty: "kus" });
    network.last.receive({ ty: "kunir" });
    network.last.receive({ ty: "kur", r: 50 });
    network.last.receive({ ty: "kualtu", r: 3, ur: 9 });

    expect(ended).toEqual(["kicked"]);
    expect(notices).toHaveLength(5);
    expect(notices[3]).toContain("50");
    expect(notices[4]).toContain("3");
  });

  test("кнопка «Сдаться» подчиняется серверному признаку mgu", async() => {
    const { network, session, first } = await setup();
    session.start(first);
    network.last.receive({ ty: "rst", rst: { gs: { s: 3, t: 5, d: 3 }, pls: roster(8), pd: [{ puo: "p1", a: true, r: 1 }] } });
    network.last.receive({ ty: "ps", m: 3, ma: 3, c: 4, ca: 5 });
    expect(session.state.canGiveUp).toBe(false);

    network.last.receive({ ty: "ps", m: 3, ma: 3, c: 4, ca: 5, mgu: true });
    expect(session.state.canGiveUp).toBe(true);

    network.last.receive({ ty: "ps", m: 1, ma: 3, c: 4, ca: 5, mgu: false });
    expect(session.state.canGiveUp).toBe(false);
  });
});

describe("RoomSession", () => {
  test("при старте создаёт игрока в комнате с типом модели из ответа на вход", async() => {
    const { network, session, first } = await setup();
    expect(session.state.settings).toMatchObject({ id: "r1", modelType: 1, title: "Комната", maxPlayers: 8 });

    session.start(first);
    expect(network.last.sent[0]).toEqual({ ty: "cp", uo: "uo1", t: "t", ro: "r1", rmt: 1 });
  });

  test("регистрация: список, вход и выход игроков, таймер, сообщения", async() => {
    const { network, session, first } = await setup();
    session.start(first);

    network.last.receive({ ty: "rst", rst: { gs: { s: 0, t: 0 }, pls: roster(2), ms: [{ tx: "добро пожаловать", t: 4 }] } });
    expect(session.state.lobby).toHaveLength(2);
    expect(session.state.messages.entries[0]).toMatchObject({ kind: "system", text: "Игра началась" });

    network.last.receive({ ty: "ap", p: { o: "o3", pu: { puo: "p3", u: "Новый" } } });
    network.last.receive({ ty: "rp", puo: "p2" });
    network.last.receive({ t: 9 });
    network.last.receive({ ty: "m", m: { tx: "всем привет", uu: { u: "Игрок1", puo: "p1" } } });

    expect(session.state.lobby.map(player => player.username)).toEqual(["Игрок1", "Новый"]);
    expect(session.state.info).toBe("Игра начнётся через 9");
    expect(session.state.messages.entries.at(-1)).toMatchObject({ kind: "message", text: "всем привет" });
  });

  test("игра: смена фазы, обновление игроков, ход и «сдаться» уходят на сервер", async() => {
    const { network, session, first } = await setup();
    session.start(first);
    network.last.receive({ ty: "rst", rst: { gs: { s: 3, t: 30, d: 1 }, pls: roster(8), data: roster(8).map((p, i) => ({ puo: p.pu.puo, a: true, r: i == 0 ? 4 : 1 })), rls: { "1": 6, "4": 2 } } });

    expect(session.state.phase).toBe("game");
    expect(session.state.me?.role).toBe(4);
    const target = session.state.players[2]!;
    expect(session.state.actionFor(target)).toBe("kill");

    session.act(target.playerObjectId);
    expect(network.last.sent.at(-1)).toEqual({ ty: "ra", puo: "p3", ro: "r1", rmt: 1 });

    network.last.receive({ ty: "gd", d: 3, t: 45 });
    network.last.receive({ ty: "ud", data: [{ puo: "p3", a: false }] });
    network.last.receive({ ty: "ps", ma: 2, m: 2, ca: 6, c: 5 });
    expect(session.state.dayTime).toBe(3);
    expect(session.state.timer).toBe(45);
    expect(session.state.playerBy("p3")?.alive).toBe(false);
    expect(session.state.stat).toMatchObject({ mafiaAlive: 2, civilianAlive: 5 });

    session.giveUp();
    expect(network.last.sent.at(-1)).toEqual({ ty: "agu", ro: "r1" });
  });

  test("сообщения: при смене фазы заменяются, если включена очистка; иначе дополняются", async() => {
    for(const [clearMessages, expected] of [[true, ["новое"]], [false, ["старое", "новое"]]] as const) {
      const { network, session, first } = await setup({ clearMessages });
      session.start(first);
      network.last.receive({ ty: "rst", rst: { gs: { s: 0 }, pls: roster(2), ms: [{ tx: "старое", uu: { u: "А" } }] } });
      network.last.receive({ ty: "rst", rst: { gs: { s: 3, d: 1 }, pls: roster(2), data: [], ms: [{ tx: "новое", uu: { u: "Б" } }] } });
      expect(session.state.messages.entries.map(entry => entry.text)).toEqual([...expected]);
    }
  });

  test("при подготовке и начале игры история не дублируется", async() => {
    for(const clearMessages of [true, false]) {
      const { network, session, first } = await setup({ clearMessages });
      session.start(first);
      const history = [{ tx: "привет", uu: { u: "А", puo: "p1" } }, { tx: "как дела", uu: { u: "Б", puo: "p2" } }];

      network.last.receive({ ty: "rst", rst: { gs: { s: 0 }, pls: roster(8), ms: history } });
      network.last.receive({ ty: "m", m: { tx: "живое", uu: { u: "А", puo: "p1" } } });
      network.last.receive({ ty: "rst", rst: { gs: { s: 2, t: 5 }, pls: roster(8), ms: [...history, { tx: "живое", uu: { u: "А", puo: "p1" } }] } });       // подготовка
      network.last.receive({ ty: "rst", rst: { gs: { s: 3, d: 1 }, pls: roster(8), data: [], ms: [...history, { tx: "живое", uu: { u: "А", puo: "p1" } }, { t: 6 }] } });   // игра

      const texts = session.state.messages.entries.map(entry => entry.text);
      expect(texts.filter(text => text == "привет")).toHaveLength(1);
      expect(texts.filter(text => text == "живое")).toHaveLength(1);
      expect(texts).toContain("Наступила ночь [МАФИЯ в чате]");
    }
  });

  test("конец игры: переписка и стол остаются на месте, роли раскрываются", async() => {
    const { network, session, first } = await setup();
    session.start(first);
    network.last.receive({ ty: "rst", rst: { gs: { s: 3, d: 1 }, pls: roster(8), data: [], ms: [{ tx: "ход игры", uu: { u: "А" } }] } });

    network.last.receive({ ty: "rst", rst: { gs: { s: 4, t: 0 } } });
    network.last.receive({ ty: "roles", roles: [{ uo: "o2", r: 4 }] });

    expect(session.state.players).toHaveLength(8);
    expect(session.state.messages.entries.map(entry => entry.text)).toEqual(["ход игры"]);
    expect(session.state.playerBy("p2")?.role).toBe(4);
  });

  test("отправка: опьянение бармена, пустые сообщения не уходят", async() => {
    const { network, session, first } = await setup();
    session.start(first);

    session.send("привет");
    session.send("  ");
    expect(network.last.sent.filter(packet => packet.ty == "rmc")).toEqual([{ ty: "rmc", m: { tx: "привет", mstl: 0, mstk: false }, ro: "r1", rmt: 1 }]);
  });

  test("голосование за исключение: таймер, один голос, конец голосования", async() => {
    const { network, session, first } = await setup();
    session.start(first);

    network.last.receive({ ty: "ku", puo: "p5", t: 10 });
    expect(session.kickVote).toEqual({ targetPlayerObjectId: "p5", timer: 10, voted: false });

    network.last.receive({ ty: "kt", t: 7 });
    session.voteKick(true);
    expect(network.last.sent.at(-1)).toEqual({ ty: "kuv", ro: "r1", v: true });
    expect(session.kickVote).toMatchObject({ timer: 7, voted: true });

    network.last.receive({ ty: "kt", t: 0 });
    expect(session.kickVote).toBeUndefined();
  });

  test("конец игры сохраняется в историю в формате старой версии один раз; без настройки не сохраняется", async() => {
    const { network, files, session, first } = await setup();
    session.start(first);
    network.last.receive({ ty: "rst", rst: { gs: { s: 3, d: 2 }, pls: roster(8), data: [], ms: [{ tx: "ход игры", uu: { u: "А" } }] } });
    network.last.receive({ ty: "ps", ma: 2, m: 0, ca: 6, c: 4 });
    network.last.receive({ ty: "gs", gs: { s: 4, t: 0 } });
    network.last.receive({ ty: "gs", gs: { s: 4, t: 0 } });
    await tick();

    const history = await historyDocument(files).read();
    expect(history.rooms).toHaveLength(1);
    expect(history.rooms[0]).toMatchObject({ title: "Комната", modelType: 1, maxPlayers: 8, selectedRoles: [2], playersStat: { ty: "ps", ma: 2 }, messages: [{ tx: "ход игры" }] });
    expect(Object.keys(history.rooms[0]!.playersData)).toHaveLength(8);

    const off = await setup({ saveHistory: false });
    off.session.start(off.first);
    off.network.last.receive({ ty: "rst", rst: { gs: { s: 4 }, pls: roster(2), data: [] } });
    await tick();
    expect((await historyDocument(off.files).read()).rooms).toHaveLength(0);
  });

  test("выход отправляет leaveRoom и отписывается; двойной аккаунт сообщается", async() => {
    const { network, session, first } = await setup();
    session.start(first);
    const ended: string[] = [];
    session.on("ended", reason => ended.push(reason));
    network.last.receive({ ty: "uuda" });
    expect(ended).toEqual(["doubleAccount"]);

    session.leave();
    session.leave();
    expect(network.last.sent.filter(packet => packet.ty == "rp")).toEqual([{ ty: "rp", ro: "r1" }]);

    network.last.receive({ t: 3 });
    expect(session.state.timer).toBe(0);   // пакеты после выхода игнорируются
  });

  test("просмотр сохранённой игры: стол и роли как в конце партии, сообщения на месте, сеть не используется", async() => {
    const { network, session, first, deps } = await setup();
    session.start(first);
    network.last.receive({ ty: "rst", rst: { gs: { s: 3, d: 2 }, pls: roster(8), data: roster(8).map((p, i) => ({ puo: p.pu.puo, a: i != 3, r: i < 2 ? 4 : 1 })), ms: [{ tx: "ход игры", uu: { u: "А", puo: "p1" } }] } });
    network.last.receive({ ty: "ps", ma: 2, m: 2, ca: 6, c: 1 });
    network.last.receive({ ty: "gs", gs: { s: 4, t: 0 } });
    await tick();

    const record = deps.history.data.rooms[0]!;
    const replay = RoomSession.fromHistory(deps, JSON.parse(JSON.stringify(record)) as HistoryRecord, "history:0");
    const sentBefore = network.last.sent.length;

    expect(replay.replay).toBe(true);
    expect(replay.state.phase).toBe("finished");
    expect(replay.state.inGame).toBe(true);
    expect(replay.state.players).toHaveLength(8);
    expect(replay.state.me).toMatchObject({ role: 4, alive: true });
    expect(replay.state.playerBy("p4")?.alive).toBe(false);
    expect(replay.state.stat).toMatchObject({ mafiaAlive: 2, civilianAlive: 1 });
    expect(replay.state.messages.entries.map(entry => entry.text)).toEqual(["ход игры"]);

    // ходить, писать и «выходить» в просмотре нельзя: ничего не уходит на сервер
    replay.act("p3");
    replay.send("привет");
    replay.giveUp();
    replay.voteKick(true);
    replay.leave();
    expect(network.last.sent).toHaveLength(sentBefore);
  });

  test("роли, раскрытые уже после сохранения игры, дописываются в запись истории", async() => {
    const { network, session, first, history } = await setup();
    session.start(first);
    network.last.receive({ ty: "rst", rst: { gs: { s: 3, d: 2 }, pls: roster(8), data: [] } });
    network.last.receive({ ty: "gs", gs: { s: 4, t: 0 } });
    expect((history.data.rooms[0]!.playersData.p2 as { role?: number }).role).toBeUndefined();

    network.last.receive({ ty: "roles", roles: [{ uo: "o2", r: 4 }] });
    expect((history.data.rooms[0]!.playersData.p2 as { role?: number }).role).toBe(4);
    expect(history.data.rooms).toHaveLength(1);
  });

  test("исход игры: по тому, кого осталось больше, и вашей роли; мусор в записях старой версии не ломает", async() => {
    const record = (role: number | undefined, mafia: number, civil: number): HistoryRecord => ({
      messages: [], playersStat: { m: mafia, c: civil }, playersData: { p1: { role } }, modelType: 0, title: "", maxPlayers: 8, minPlayers: 5, minLevel: 1, isVipEnabled: false, selectedRoles: [], gameDayTime: 2, createdAt: 1
    });
    expect(outcomeOf(record(4, 3, 1), "p1")).toBe("win");     // мафия за мафию
    expect(outcomeOf(record(1, 3, 1), "p1")).toBe("lose");
    expect(outcomeOf(record(1, 0, 4), "p1")).toBe("win");     // мирный при победе мирных
    expect(outcomeOf(record(4, 0, 4), "p1")).toBe("lose");
    expect(outcomeOf(record(1, 2, 2), "p1")).toBe("draw");
    expect(outcomeOf(record(undefined, 2, 1), "p1")).toBeUndefined();
    expect(outcomeOf({ ...record(1, 1, 1), playersStat: undefined }, "p1")).toBeUndefined();
    expect(outcomeOf(record(1, 1, 2), "нет-такого")).toBeUndefined();
  });

  test("конец игры: победитель из итогового сообщения, «игра окончена» один раз, победа по роли, хост - первый игрок", async() => {
    const { network, session, first } = await setup();
    session.start(first);
    let over = 0;
    session.on("over", () => { over++; });

    network.last.receive({ ty: "rst", rst: { gs: { s: 3, t: 20, d: 1 }, pls: roster(6), data: roster(6).map((p, i) => ({ puo: p.pu.puo, a: true, r: i == 0 ? 1 : undefined })) } });
    expect(session.state.host).toEqual({ playerObjectId: "p1", username: "Игрок1" });
    expect(session.state.winner).toBeUndefined();

    network.last.receive({ ty: "m", m: { t: 16 } });
    // итог от сервера (поля разобраны по клиенту официального приложения)
    network.last.receive({ ty: "gf", ex: 120, scns: 15, t: 1, ac: 100, mmscr: -3 });
    expect(session.state.finish).toMatchObject({ experience: 120, silver: 15, activity: 100, rating: -3 });
    network.last.receive({ ty: "gs", gs: { s: 4, t: 35, d: 0 } });
    network.last.receive({ ty: "rst", rst: { gs: { s: 4, t: 35, d: 0 } } });
    await tick();

    expect(session.state.winner).toBe("peaceful");
    expect(session.state.won).toBe(true);          // я мирный, победили мирные
    expect(over).toBe(1);
  });
});
