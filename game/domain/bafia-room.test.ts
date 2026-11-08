import { describe, expect, test } from "bun:test";
import type { BafiaRoomEvent, BafiaRoomInfo, BafiaRoomState } from "@common/bafia/protocol";
import { createStorage, MemoryFileStore } from "@common/storage";
import { BafiaRoomAdapter, type BafiaRoomLink } from "./bafia-room";
import { Role } from "./enums";
import { historyDocument } from "./history";
import { RoomSession } from "./room/session";
import { SettingsStore } from "./settings";
import { DocumentStore } from "./store";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

const info: BafiaRoomInfo = { id: "r1", title: "Комната", host: "Админ", players: 3, minPlayers: 4, maxPlayers: 12, status: 0 };
const lobby = (extra: Partial<BafiaRoomState> = {}): BafiaRoomState => ({
  status: 0, dayTime: 0, timer: 30, host: "p1", voteChat: false, known: [],
  players: [{ id: "p1", nick: "Админ", alive: true }, { id: "p2", nick: "Аня", alive: true }, { id: "p3", nick: "Боря", alive: true }], ...extra
});

async function setup(state = lobby(), you = "p2") {
  const calls: string[] = [];
  const listeners: { onEvents: (events: BafiaRoomEvent[]) => void, onClosed: () => void }[] = [];
  const link: BafiaRoomLink = {
    act: async targets => { calls.push("act " + targets.join(",")); return { ok: true }; },
    bomb: async target => { calls.push("bomb " + target); return { ok: true }; },
    chat: async text => { calls.push("chat " + text); return { ok: true }; },
    leave: async () => { calls.push("leave"); return { ok: true }; },
    kick: async target => { calls.push("kick " + target); return { ok: true }; },
    voteKick: async vote => { calls.push("voteKick " + vote); return { ok: true }; },
    subscribe: (room, onEvents, onClosed) => { listeners.push({ onEvents, onClosed }); return () => { listeners.length = 0; }; }
  };
  const adapter = new BafiaRoomAdapter(link, info, you, state);
  const files = new MemoryFileStore();
  const settings = await SettingsStore.load(createStorage(files).settings);
  const history = await DocumentStore.load(historyDocument(files));
  const session = new RoomSession({ client: adapter.client as never, history, settings, myPlayerObjectId: you }, adapter.settings());
  session.start();
  await tick();
  return { adapter, session, calls, push: (...events: BafiaRoomEvent[]) => listeners[0]!.onEvents(events), closeRoom: () => listeners[0]!.onClosed(), listeners };
}

describe("комната Бафии на экране комнаты", () => {
  test("вход: игроки до начала игры видны, настройки комнаты (название, число игроков, создатель) берутся из Бафии; приходят и уходят в реальном времени", async() => {
    const { session, push } = await setup();
    expect(session.state.settings).toMatchObject({ id: "r1", title: "Комната", minPlayers: 4, maxPlayers: 12, creator: "p1" });
    expect(session.state.lobby.map(player => player.username)).toEqual(["Админ", "Аня", "Боря"]);
    expect(session.state.phase).toBe("registration");

    push({ kind: "joined", player: { id: "p4", nick: "Вася", alive: true } }, { kind: "message", type: 2, text: "", from: "p4" });
    expect(session.state.lobby.map(player => player.username)).toEqual(["Админ", "Аня", "Боря", "Вася"]);
    expect(session.state.messages.entries.at(-1)).toMatchObject({ kind: "join", user: { username: "Вася" } });
    push({ kind: "left", id: "p3" }, { kind: "message", type: 3, text: "", from: "p3" });
    expect(session.state.lobby.map(player => player.username)).toEqual(["Админ", "Аня", "Вася"]);
    expect(session.state.messages.entries.at(-1)).toMatchObject({ kind: "leave", user: { username: "Боря" } });   // ник вышедшего помнится
    expect(session.state.host?.username).toBe("Админ");
  });

  test("начало игры: твоя роль, стол по порядку, таймер, этап, счёт команд; чат с ником, а закрытое анонимное сообщение без ника", async() => {
    const { session, push } = await setup();
    push(
      { kind: "phase", status: 3, dayTime: 1, timer: 40 },
      { kind: "role", role: Role.Mafia },
      { kind: "known", players: [{ id: "p3", role: Role.Mafia }] },
      { kind: "stat", mafiaAll: 2, mafiaAlive: 2, civilianAll: 1, civilianAlive: 1 },
      { kind: "message", type: 6, text: "Наступила ночь [МАФИЯ в чате]" },
      { kind: "message", type: 11, text: "кого убиваем", from: "p3" },
      { kind: "message", type: 26, text: "я информатор", from: "p1", anonymous: true },
      { kind: "timer", timer: 39 }
    );
    expect(session.state.phase).toBe("game");
    expect(session.state.isNight).toBe(true);
    expect(session.state.timer).toBe(39);
    expect(session.state.me?.role).toBe(Role.Mafia);
    expect(session.state.players.find(player => player.playerObjectId == "p3")?.role).toBe(Role.Mafia);   // напарника знаю
    expect(session.state.players.find(player => player.playerObjectId == "p1")?.role ?? 0).toBe(0);         // остальных нет
    expect(session.state.stat).toMatchObject({ mafiaAll: 2, mafiaAlive: 2, civilianAll: 1, civilianAlive: 1 });
    const texts = session.state.messages.entries.map(entry => [entry.user?.username, entry.text]);
    expect(texts).toContainEqual(["Боря", "кого убиваем"]);
    expect(texts).toContainEqual(["Информатор", "я информатор"]);                 // закрытое сообщение показано от лица роли, без ника
  });

  test("ходы: нажатие на игрока ночью уходит в Бафию, после хода действие помечено выполненным; голосование и взрыв террориста; журналист выбирает двоих", async() => {
    const mafia = await setup();
    mafia.push({ kind: "phase", status: 3, dayTime: 1, timer: 40 }, { kind: "role", role: Role.Mafia });
    mafia.session.act("p3");
    await tick();
    expect(mafia.calls).toEqual(["act p3"]);

    const terrorist = await setup();
    terrorist.push({ kind: "phase", status: 3, dayTime: 3, timer: 40 }, { kind: "role", role: Role.Terrorist });
    terrorist.session.act("p3");
    await tick();
    expect(terrorist.calls).toEqual(["bomb p3"]);

    const journalist = await setup();
    journalist.push({ kind: "phase", status: 3, dayTime: 1, timer: 40 }, { kind: "role", role: Role.Journalist });
    journalist.session.act("p1");
    await tick();
    expect(journalist.calls).toEqual([]);                       // первого запоминаем, ждём второго
    journalist.session.act("p3");
    await tick();
    expect(journalist.calls).toEqual(["act p1,p3"]);

    const civilian = await setup();
    civilian.push({ kind: "phase", status: 3, dayTime: 3, timer: 40 }, { kind: "role", role: Role.Civilian });
    civilian.session.act("p1");
    await tick();
    expect(civilian.calls).toEqual(["act p1"]);
  });

  test("сообщение игрока уходит в Бафию; выход из комнаты тоже; после выхода события больше не приходят", async() => {
    const { session, calls, push, adapter } = await setup();
    session.send("привет всем");
    await tick();
    expect(calls).toEqual(["chat привет всем"]);
    const before = session.state.messages.entries.length;
    session.leave();
    await tick();
    expect(calls).toContain("leave");
    expect(adapter.client.on).toBeDefined();
    expect(() => push({ kind: "message", type: 1, text: "после выхода", from: "p1" })).toThrow();   // подписка снята
    expect(session.state.messages.entries.length).toBe(before);
  });

  test("гибель, голоса, конец игры: игрок убран из живых, голоса видны на столе, победитель и роли раскрыты", async() => {
    const { session, push } = await setup();
    push({ kind: "phase", status: 3, dayTime: 3, timer: 40 }, { kind: "role", role: Role.Civilian });
    push({ kind: "votes", counts: { p3: 2 } });
    expect(session.state.players.find(player => player.playerObjectId == "p3")?.vote).toBe(2);
    push({ kind: "death", id: "p3" });
    expect(session.state.players.find(player => player.playerObjectId == "p3")?.alive).toBe(false);
    push({ kind: "phase", status: 3, dayTime: 1, timer: 40 });
    expect(session.state.players.find(player => player.playerObjectId == "p3")?.vote ?? 0).toBe(0);     // новый этап: голоса сняты

    push({ kind: "message", type: 16, text: "Игра окончена! МИРНЫЕ ЖИТЕЛИ победили!" }, { kind: "end", winner: "peaceful", roles: [{ id: "p1", role: Role.Mafia }, { id: "p2", role: Role.Civilian }, { id: "p3", role: Role.Sheriff }] });
    expect(session.state.winner).toBe("peaceful");
    expect(session.state.phase).toBe("finished");
    expect(session.state.players.find(player => player.playerObjectId == "p1")?.role).toBe(Role.Mafia);
  });

  test("возвращение после обрыва: состояние обновляется целиком (этап, кто жив, роль), прежние события не дублируются", async() => {
    const { session, adapter } = await setup();
    adapter.resync(lobby({ status: 3, dayTime: 2, timer: 25, role: Role.Doctor, players: [{ id: "p1", nick: "Админ", alive: true }, { id: "p2", nick: "Аня", alive: true }, { id: "p3", nick: "Боря", alive: false }], known: [], roleCounts: { [Role.Doctor]: 1, [Role.Mafia]: 1, [Role.Civilian]: 1 }, stat: { mafiaAll: 1, mafiaAlive: 1, civilianAll: 2, civilianAlive: 1 } }));
    expect(session.state.phase).toBe("game");
    expect(session.state.dayTime).toBe(2);
    expect(session.state.me?.role).toBe(Role.Doctor);
    expect(session.state.players.find(player => player.playerObjectId == "p3")?.alive).toBe(false);
    expect(session.state.roleCounts).toEqual({ [Role.Doctor]: 1, [Role.Mafia]: 1, [Role.Civilian]: 1 });
  });

  test("комната закрылась: адаптер отписывается и сообщает об этом", async() => {
    const { adapter, closeRoom, listeners } = await setup();
    let closed = 0;
    adapter.onClosed = () => { closed++; };
    closeRoom();
    expect(closed).toBe(1);
    expect(listeners).toHaveLength(0);
  });
});

describe("смена знаний у стола", () => {
  test("роли перемешались: прежние известные роли стираются со стола, новые приходят; свои роль и стол сохраняются", async() => {
    const { session, push } = await setup();
    push({ kind: "phase", status: 3, dayTime: 1, timer: 40 }, { kind: "role", role: Role.Mafia }, { kind: "known", players: [{ id: "p3", role: Role.Mafia }] });
    expect(session.state.players.find(player => player.playerObjectId == "p3")?.role).toBe(Role.Mafia);
    push({ kind: "role", role: Role.Doctor }, { kind: "known", players: [{ id: "p1", role: Role.Doctor }], reset: true });
    expect(session.state.me?.role).toBe(Role.Doctor);
    expect(session.state.players.find(player => player.playerObjectId == "p3")?.role ?? 0).toBe(0);          // прежнее знание отменено
    expect(session.state.players.find(player => player.playerObjectId == "p1")?.role).toBe(Role.Doctor);
  });
});
