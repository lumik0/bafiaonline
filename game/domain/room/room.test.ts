import { describe, expect, test } from "bun:test";
import { decode } from "@common/protocol";
import { Role } from "../enums";
import { toRoomEntry, firstTarget } from "./messages";
import { RoomState, type RoomSettings } from "./state";

const settings: RoomSettings = { id: "r1", modelType: 0, title: "Тест", minPlayers: 5, maxPlayers: 8, minLevel: 1, vip: false, roles: [2] };
const stats = (wire: object) => { const message = decode(JSON.stringify({ ty: "rst", rst: wire })); if(message.name != "roomStatistics") throw new Error("не то"); return message.data.statistics; };
const pl = (o: string, puo: string, u: string) => ({ o, pu: { puo, u } });

/** игра за столом из 8: я (p1) и семь остальных; роли задаются отдельно */
function startGame(myRole: number, dayTime = 1) {
  const state = new RoomState(settings, "p1");
  const players = Array.from({ length: 8 }, (_, i) => pl(`o${i + 1}`, `p${i + 1}`, `Игрок${i + 1}`));
  state.applyStatistics(stats({
    gs: { s: 3, t: 30, d: dayTime }, pls: players,
    data: players.map((p, i) => ({ puo: p.pu.puo, a: true, r: i == 0 ? myRole : 1 })), rls: { "1": 5, "4": 2 }
  }));
  return state;
}

describe("регистрация", () => {
  test("игроки в списке, заголовок с числом игроков, строка с таймером", () => {
    const state = new RoomState(settings, "p1");
    state.applyStatistics(stats({ gs: { s: 0, t: 0 }, pls: [pl("o1", "p1", "Я"), pl("o2", "p2", "Друг")] }));

    expect(state.phase).toBe("registration");
    expect(state.lobby.map(player => player.username)).toEqual(["Я", "Друг"]);
    expect(state.title).toBe("Тест 2 [5/8]");
    expect(state.info).toBe("Регистрация");

    state.setTimer(10);
    expect(state.info).toBe("Игра начнётся через 10");
    state.applyStatus({ status: 2, timer: 7 });
    expect(state.info).toBe("Подготовка через 7");

    state.playerJoined({ objectId: "o3", user: { playerUser: { playerObjectId: "p3", username: "Новый" } } });
    state.playerJoined({ objectId: "o3", user: { playerUser: { playerObjectId: "p3", username: "Новый" } } });   // повтор не удваивает
    state.playerLeft("p2");
    expect(state.lobby.map(player => player.username)).toEqual(["Я", "Новый"]);
  });
});

describe("игра", () => {
  test("порядок за столом, ваша роль, обновления меняют только присланные поля", () => {
    const state = startGame(Role.Sheriff);
    expect(state.phase).toBe("game");
    expect(state.title).toBe("Тест");
    expect(state.players.map(player => player.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(state.me).toMatchObject({ username: "Игрок1", role: Role.Sheriff, alive: true });

    const decoded = decode(JSON.stringify({ ty: "ud", data: [{ puo: "p3", a: false }, { puo: "p4", v: 2, abr: [3] }, { puo: "нет-такого", a: false }] }));
    if(decoded.name == "userData") state.applyPlayersData(decoded.data.players);

    expect(state.playerBy("p3")).toMatchObject({ alive: false, role: 1 });     // роль не затёрта
    expect(state.playerBy("p4")).toMatchObject({ vote: 2, affectedByRoles: [3], alive: true });
  });

  test("повторная статистика (смена фазы) сохраняет известные роли и пометки", () => {
    const state = startGame(Role.Mafia);
    state.setKnownRoles([{ playerObjectId: "p2", role: Role.Mafia }]);
    state.markRole("p5", Role.Doctor);

    state.applyStatistics(stats({ gs: { s: 3, t: 20, d: 2 }, pls: Array.from({ length: 8 }, (_, i) => pl(`o${i + 1}`, `p${i + 1}`, `Игрок${i + 1}`)) }));
    expect(state.playerBy("p2")?.role).toBe(Role.Mafia);
    expect(state.playerBy("p5")?.preRole).toBe(Role.Doctor);
    expect(state.dayTime).toBe(2);
  });

  test("в конце игры состояние без списка игроков не стирает стол", () => {
    const state = startGame(Role.Civilian);
    state.applyStatistics(stats({ gs: { s: 4, t: 0 } }));

    expect(state.phase).toBe("finished");
    expect(state.inGame).toBe(true);
    expect(state.players).toHaveLength(8);
    expect(state.me?.role).toBe(Role.Civilian);
  });

  test("конец игры раскрывает роли по id пользователя", () => {
    const state = startGame(Role.Civilian);
    state.revealRoles([{ userObjectId: "o2", role: Role.Mafia }, { userObjectId: "неизвестный", role: Role.Doctor }]);
    expect(state.playerBy("p2")?.role).toBe(Role.Mafia);
    expect(state.players).toHaveLength(8);
  });

  test("таймер: чем меньше времени, тем тревожнее", () => {
    const state = startGame(Role.Civilian);
    const levels = [30, 15, 10, 5].map(seconds => { state.setTimer(seconds); return state.timerLevel; });
    expect(levels).toEqual(["normal", "warning", "danger", "critical"]);
  });
});

describe("исправления багов старой версии", () => {
  test("мафия видит напарников, даже если пакет с ролями пришёл раньше, чем появился стол", () => {
    const state = new RoomState(settings, "p1");
    // роли союзников приходят до того, как игра началась и стол собран
    state.setKnownRoles([{ playerObjectId: "p3", role: Role.Mafia }, { playerObjectId: "p5", role: Role.Informer }]);
    const players = Array.from({ length: 8 }, (_, i) => pl(`o${i + 1}`, `p${i + 1}`, `Игрок${i + 1}`));
    state.applyStatistics(stats({ gs: { s: 3, t: 30, d: 1 }, pls: players, data: players.map((p, i) => ({ puo: p.pu.puo, a: true, r: i == 0 ? Role.Mafia : undefined })) }));

    expect(state.players.map(player => player.role)).toEqual([Role.Mafia, undefined, Role.Mafia, undefined, Role.Informer, undefined, undefined, undefined]);

    // позже пришла ещё одна роль, стол при смене фазы пересобирается - роли не теряются
    state.setKnownRoles([{ playerObjectId: "p2", role: Role.Barman }]);
    state.applyStatistics(stats({ gs: { s: 3, t: 20, d: 3 }, pls: players }));
    expect(state.playerBy("p2")?.role).toBe(Role.Barman);
    expect(state.playerBy("p3")?.role).toBe(Role.Mafia);
  });
});

describe("хост комнаты", () => {
  test("создатель из данных комнаты; нет его в комнате - хоста нет; создатель неизвестен - первый игрок", () => {
    const state = new RoomState({ ...settings, creator: "p3" }, "p1");
    state.applyStatistics(stats({ gs: { s: 0, t: 0 }, pls: [pl("o1", "p1", "Я"), pl("o2", "p2", "Друг"), pl("o3", "p3", "Хост")] }));
    expect(state.host).toEqual({ playerObjectId: "p3", username: "Хост" });
    state.playerLeft("p3");
    expect(state.host).toBeUndefined();

    const unknown = new RoomState(settings, "p1");
    unknown.applyStatistics(stats({ gs: { s: 0, t: 0 }, pls: [pl("o1", "p1", "Я"), pl("o2", "p2", "Друг")] }));
    expect(unknown.host?.username).toBe("Я");

    // создатель может быть записан id пользователя (o), а не публичным id
    const byUser = new RoomState({ ...settings, creator: "o2" }, "p1");
    byUser.applyStatistics(stats({ gs: { s: 0, t: 0 }, pls: [pl("o1", "p1", "Я"), pl("o2", "p2", "Друг")] }));
    expect(byUser.host?.username).toBe("Друг");
  });
});

describe("действия по ролям", () => {
  const actions = (state: RoomState) => Object.fromEntries(state.players.slice(1).map(player => [player.playerObjectId, state.actionFor(player)]));

  test("мафия ночью убивает, но не своих; мирные ночью без действий", () => {
    const mafia = startGame(Role.Mafia, 1);
    mafia.setKnownRoles([{ playerObjectId: "p2", role: Role.Mafia }]);
    expect(mafia.actionFor(mafia.playerBy("p2")!)).toBeUndefined();
    expect(mafia.actionFor(mafia.playerBy("p3")!)).toBe("kill");
    expect(mafia.actionFor(mafia.me!)).toBeUndefined();   // себя нельзя

    expect(Object.values(actions(startGame(Role.Civilian, 1))).every(action => action === undefined)).toBe(true);
  });

  test("у каждой роли своё время суток", () => {
    const cases: [number, number, string][] = [
      [Role.Doctor, 1, "_2"], [Role.Sheriff, 1, "check"], [Role.Lover, 0, "_5"], [Role.Terrorist, 3, "_6"],
      [Role.Journalist, 1, "_7"], [Role.Bodyguard, 2, "_8"], [Role.Barman, 1, "_9"], [Role.Informer, 1, "check"]
    ];
    for(const [role, day, action] of cases) {
      const state = startGame(role, day);
      expect(state.actionFor(state.players[2]!)).toBe(action);

      // в другое время суток (кроме дня, когда голосуют все) действия нет
      const wrongDay = [0, 1, 2].find(candidate => candidate != day)!;
      const other = startGame(role, wrongDay);
      expect(other.actionFor(other.players[2]!)).toBeUndefined();
    }
  });

  test("днём все голосуют против любого живого", () => {
    const state = startGame(Role.Civilian, 3);
    expect(state.actionFor(state.playerBy("p4")!)).toBe("kill");
    state.applyPlayersData([{ playerObjectId: "p4", alive: false }]);
    expect(state.actionFor(state.playerBy("p4")!)).toBeUndefined();
  });

  test("после действия повторить нельзя; напоённый барменом может ещё раз; мёртвый и не в игре - нет", () => {
    const state = startGame(Role.Doctor, 1);
    const target = state.playerBy("p2")!;
    expect(state.actionFor(target)).toBe("_2");

    state.applyPlayersData([{ playerObjectId: "p1", isNightActionUsed: true }]);
    expect(state.actionFor(target)).toBeUndefined();
    state.applyPlayersData([{ playerObjectId: "p1", affectedByRoles: [Role.Barman] }]);
    expect(state.actionFor(target)).toBeUndefined();   // барман действует, только если ночное действие НЕ использовано

    state.applyPlayersData([{ playerObjectId: "p1", isNightActionUsed: false }]);
    expect(state.actionFor(target)).toBe("_2");

    state.applyPlayersData([{ playerObjectId: "p1", alive: false }]);
    expect(state.actionFor(target)).toBeUndefined();

    state.applyStatus({ status: 4 });
    state.applyPlayersData([{ playerObjectId: "p1", alive: true }]);
    expect(state.actionFor(target)).toBeUndefined();   // игра закончилась
  });

  test("баг старой версии: напоённый барменом телохранитель всё равно защищает (один раз)", () => {
    const state = startGame(Role.Bodyguard, 2);
    const target = state.playerBy("p3")!;
    expect(state.actionFor(target)).toBe("_8");

    // сервер отмечает дневное действие напоённого использованным (он не голосует), защита от этого не зависит
    state.applyPlayersData([{ playerObjectId: "p1", affectedByRoles: [Role.Barman], isDayActionUsed: true }]);
    expect(state.actionFor(target)).toBe("_8");

    state.applyPlayersData([{ playerObjectId: "p1", isNightActionUsed: true }]);
    expect(state.actionFor(target)).toBeUndefined();   // защита уже поставлена

    // напоённому мирному днём по-прежнему нельзя голосовать
    const civilian = startGame(Role.Civilian, 3);
    civilian.applyPlayersData([{ playerObjectId: "p1", affectedByRoles: [Role.Barman], isDayActionUsed: true }]);
    expect(civilian.actionFor(civilian.playerBy("p3")!)).toBeUndefined();
  });

  test("«Сдаться»: за столом больше 7 и вы остались вдвоём или один из команды", () => {
    const state = startGame(Role.Civilian);
    state.setStat({ mafiaAlive: 2, civilianAlive: 3 });
    expect(state.canGiveUp).toBe(false);
    state.setStat({ mafiaAlive: 2, civilianAlive: 1 });
    expect(state.canGiveUp).toBe(true);
    state.setStat({ mafiaAlive: 1, civilianAlive: 4 });
    expect(state.canGiveUp).toBe(false);          // вы мирный, а мафия одна - вам рано
    state.setStat({ mafiaAlive: 1, civilianAlive: 1 });
    expect(state.canGiveUp).toBe(true);

    const mafia = startGame(Role.Mafia);
    mafia.setStat({ mafiaAlive: 1, civilianAlive: 4 });
    expect(mafia.canGiveUp).toBe(true);
  });
});

describe("сообщения комнаты", () => {
  const entry = (wire: object) => { const message = decode(JSON.stringify({ ty: "m", m: wire })); if(message.name != "chatMessage") throw new Error("не то"); return toRoomEntry(message.data.message); };

  test("системные сообщения по типам с цветом по смыслу", () => {
    expect(entry({ t: 6 })).toMatchObject({ kind: "system", text: "Наступила ночь [МАФИЯ в чате]", tone: "info" });
    expect(entry({ t: 13, uu: { u: "Жертва", puo: "p7", ph: "m1" } })).toMatchObject({ kind: "kill", text: "УБИТ!", tone: "danger", user: { username: "Жертва", playerObjectId: "p7", photo: "m1" } });
    expect(entry({ t: 17, tx: "" })).toMatchObject({ text: "Игра окончена! МАФИЯ победила!", tone: "vote" });
    expect(entry({ t: 20, tx: "Аня#x#Боря" })).toMatchObject({ text: expect.stringContaining("игроки [Аня] и [Боря] играют в одной команде"), tone: "danger" });
    expect(entry({ t: 25, tx: "3|2" }).text).toContain("Да: 3 | Нет: 2");
    expect(entry({ t: 2, uu: { u: "Вошёл" } })).toMatchObject({ kind: "join", user: { username: "Вошёл" } });
  });

  test("реплики: голосование, роли-«говорящие», обычные сообщения", () => {
    expect(entry({ t: 10, tx: "Жертва", uu: { u: "Голосующий" } })).toMatchObject({ kind: "message", text: "Голосует за [Жертва]", tone: "vote" });
    expect(entry({ t: 11, tx: "давайте его" })).toMatchObject({ kind: "message", user: { username: "Мафия", asset: "textures/roles/mafia_chat.png" }, text: "давайте его" });
    expect(entry({ t: 26, tx: "он мафия" }).user).toMatchObject({ username: "Информатор", asset: "textures/roles/unknown_chat.png" });
    expect(entry({ t: 29, tx: "наливаю" }).user).toMatchObject({ username: "Бармен", asset: "textures/roles/barman_chat.png" });
    expect(entry({ t: 28, uu: { u: "Сдался" } })).toMatchObject({ text: "Сдался", tone: "danger" });
    expect(entry({ t: 1, tx: "привет", uu: { u: "Игрок" } })).toMatchObject({ kind: "message", text: "привет", tone: "text" });
    expect(entry({ t: 12, tx: "я труп", uu: { u: "Мёртвый" } })).toMatchObject({ tone: "dead", nickTone: "dead", label: "последнее сообщение" });
    expect(entry({ t: 17, tx: "ку-ку", uu: { u: "Дух" } })).toMatchObject({ kind: "message", tone: "night", nickTone: "night", label: "убит" });
  });

  test("голосование за исключение: цель берётся из объекта с ключами 0, 1… и из массива", () => {
    const vote = entry({ t: 24, uu: { u: "Инициатор" }, u: { "0": { u: "Цель", puo: "p9" } } });
    expect(vote).toMatchObject({ text: "[Инициатор] начал голосование, чтобы выгнать игрока [Цель] из комнаты", kickVote: { targetPlayerObjectId: "p9" } });
    expect(firstTarget([{ u: "А", puo: "p1" }])).toEqual({ username: "А", playerObjectId: "p1" });
    expect(firstTarget(undefined)).toBeUndefined();
  });
});

describe("слепок игроков для отрисовки", () => {
  test("неизменившиеся игроки остаются теми же объектами, изменившийся - новый", async() => {
    const { createViewCache } = await import("./views");
    const state = startGame(Role.Doctor, 1);
    const views = createViewCache();

    const first = views(state);
    state.setTimer(20);                      // тик таймера игроков не меняет
    const second = views(state);
    expect(second.every((view, i) => view === first[i])).toBe(true);

    state.applyPlayersData([{ playerObjectId: "p4", alive: false }]);
    const third = views(state);
    expect(third[3]).not.toBe(second[3]);
    expect(third[2]).toBe(second[2]);
    expect(third[3]).toMatchObject({ alive: false, action: undefined });
    expect(third[1]).toMatchObject({ action: "_2", role: 1 });
    expect(third[0]).toMatchObject({ isMe: true, role: Role.Doctor });
  });
});
