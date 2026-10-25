import { describe, expect, test } from "bun:test";
import { Connection, ServerClient } from "@common/net";
import { createFakeNetwork, instantDelay } from "@common/net/testing";
import { createStorage, MemoryFileStore } from "@common/storage";
import { ThemeManager } from "@common/ui/theme";
import { Navigator } from "@common/ui/nav/navigator";
import { decode } from "@common/protocol";
import { historyDocument } from "../domain/history";
import { roomSettings } from "../domain/rooms/enter";
import { RoomSession } from "../domain/room/session";
import { SettingsStore } from "../domain/settings";
import { DocumentStore } from "../domain/store";
import { User } from "../domain/user";
import type { Routes } from "../routes";
import { ModManager } from "./manager";
import { officialMod } from "./official";
import { spawnInProcess } from "./testing";

const tick = (times = 1) => new Promise<void>(async resolve => { for(let i = 0; i < times; i++) await new Promise(r => setTimeout(r, 0)); resolve(); });

async function setup(files = new MemoryFileStore()) {
  const network = createFakeNetwork();
  const client = new ServerClient(new Connection({ url: "ws://test", createSocket: () => network.createSocket(), delay: instantDelay }));
  client.session = { userObjectId: "uo1", token: "t" };
  client.connect();
  await tick();
  const log: string[] = [];
  const user = new User();
  user.applyDashboard({ user: { username: "Я", playerObjectId: "p1" } });
  const manager = new ModManager({
    client, files, user, nav: new Navigator<Routes>(), builtIn: [officialMod], spawn: spawnInProcess,
    theme: new ThemeManager({ style: { setProperty() {}, removeProperty() {} } }),
    notify: () => {}, alert: (title, text) => { log.push(`${title}|${text}`); },
    actions: { enterRoom: id => { log.push("enter " + id); }, waitAndJoin: id => { log.push("wait " + id); }, rehostRoom: async() => { log.push("rehost"); }, openProfile: id => { log.push("profile " + id); } },
    writeClipboard: async text => { log.push("copy " + text); }
  });
  await manager.start();
  await tick(3);
  return { manager, files, network, client, log, user };
}

const room = { id: "r1", title: "Комната", playersNum: 5, minPlayers: 5, maxPlayers: 21, minLevel: 1, status: 0, hasPassword: false, vip: false, friendsInRoom: 0 };

describe("официальный мод", () => {
  test("есть у каждого: включён, все разрешения, не удаляется, но выключается", async() => {
    const { manager } = await setup();
    const [info] = manager.list;
    expect(info).toMatchObject({ builtIn: true, status: "running", mod: { enabled: true, manifest: { id: "bafia" } } });
    expect(info!.mod.granted).toEqual(info!.mod.manifest.permissions);

    await expect(manager.remove("bafia")).rejects.toThrow("нельзя удалить");
    await expect(manager.install({ ...officialMod, code: "evil()" }, true)).rejects.toThrow("встроенным");

    await manager.setEnabled("bafia", false);
    expect(manager.list[0]).toMatchObject({ status: "stopped" });
    expect(await manager.menuItems("room", room)).toEqual([]);
  });

  test("выбор игрока (выключен, отключённое разрешение) переживает перезапуск, а новый код подтягивается", async() => {
    const files = new MemoryFileStore();
    const first = await setup(files);
    await first.manager.setEnabled("bafia", false);
    await first.manager.setGranted("bafia", "clipboard", false);
    first.manager.stop();

    // «обновление игры»: у встроенного мода в хранилище старый код и меньше разрешений
    const stored = JSON.parse((await files.read("/mods/installed.json"))!);
    stored.mods[0].code = "старый код";
    stored.mods[0].manifest.permissions = stored.mods[0].manifest.permissions.filter((p: string) => p != "profile:read");
    stored.mods[0].granted = stored.mods[0].granted.filter((p: string) => p != "profile:read");
    await files.write("/mods/installed.json", JSON.stringify(stored));

    const second = await setup(files);
    const mod = second.manager.find("bafia")!;
    expect(mod.enabled).toBe(false);
    expect(mod.code).toBe(officialMod.code);
    expect(mod.granted).not.toContain("clipboard");
    expect(mod.granted).toContain("profile:read");
  });

  test("меню комнаты: зайти, зайти когда освободится место, скопировать id", async() => {
    const { manager, log } = await setup();
    const entries = await manager.menuItems("room", room);
    expect(entries.map(entry => entry.label)).toEqual(["Зайти", "Зайти, когда будет 20 игроков", "Скопировать id комнаты"]);

    for(const entry of entries) manager.selectMenu(entry, "room", room);
    await tick(4);
    expect(log).toEqual(["enter r1", "wait r1", "copy r1"]);
  });

  test("профиль: расширенная статистика, кнопка винрейта открывает окно с подсказкой", async() => {
    const { manager, log } = await setup();
    const profile = { playerObjectId: "p2", username: "Игрок", isMe: false, level: 12, playedGames: 20, winsAsMafia: 4, winsAsPeaceful: 6, roleStatistics: { 4: 5, 1: 10, 2: 5 }, matchMakingScore: 0 };

    const [section] = await manager.profileSections(profile);
    expect(section!.rows.map(row => [row.label, row.value])).toEqual([
      ["Сыграно игр за Мафию", "5"], ["Сыграно игр за Мирных", "15"], ["Всего побед", "(50.00%) 10"], ["M/M", "1.50"], ["player object id", "p2"]
    ]);
    const button = section!.rows[2]!.button!;
    expect(button.id).toBe("winrate");

    manager.profileAction(section!.modId, button.id, profile);
    await tick(4);
    expect(log[0]).toContain("ВИНРЕЙТ|До 55% нужно побед подряд: 3");

    // у нового игрока нет NaN
    const [fresh] = await manager.profileSections({ ...profile, playedGames: 0, winsAsMafia: 0, winsAsPeaceful: 0, roleStatistics: {} });
    expect(fresh!.rows.map(row => row.value).join(" ")).not.toContain("NaN");
  });
});

describe("настройки комнаты и конец игры (официальный мод)", () => {
  test("шестерёнка: «Рехост»; после игры: «Профиль хоста» и «Захостить»", async() => {
    const { manager, log } = await setup();
    const info = { id: "r1", title: "Комната", minPlayers: 5, maxPlayers: 8, minLevel: 1, vip: false, roles: [2], host: { playerObjectId: "p9", username: "Хост" } };

    const settings = await manager.menuItems("roomSettings", info);
    expect(settings.map(entry => entry.label)).toEqual(["Рехост"]);

    const over = await manager.menuItems("gameOver", { ...info, winner: "mafia", won: false });
    expect(over.map(entry => entry.label)).toEqual(["Профиль хоста", "Захостить"]);
    expect((await manager.menuItems("gameOver", { ...info, host: undefined })).map(entry => entry.label)).toEqual(["Захостить"]);

    manager.selectMenu(over[0]!, "gameOver", info);
    await tick(4);
    expect(log).toEqual(["profile p9"]);
  });
});

describe("авто-клик (официальный мод)", () => {
  async function inRoom() {
    const { manager, network, client, log, files } = await setup();
    const settings = await SettingsStore.load(createStorage(files).settings);
    const history = await DocumentStore.load(historyDocument(files));
    const first = decode(JSON.stringify({ ty: "re", rr: { o: "r1", rmt: 1, tt: "Комната", mxp: 8, mnp: 5, mnl: 1, sr: [2], venb: false } }));
    const session = new RoomSession({ client, history, settings, myPlayerObjectId: "p1" }, roomSettings("r1", first));
    session.start(first);
    manager.attachRoom(session);
    const players = Array.from({ length: 8 }, (_, i) => ({ o: `o${i + 1}`, pu: { puo: `p${i + 1}`, u: `Игрок${i + 1}` } }));
    const night = (dayTime: number) => network.last.receive({
      ty: "rst", rst: { gs: { s: 3, t: 20, d: dayTime }, pls: players, data: players.map((p, i) => ({ puo: p.pu.puo, a: true, r: i == 0 ? 4 : undefined })) }
    });
    return { manager, network, log, session, night, sent: () => network.last.sent.filter(packet => packet.ty == "ra") };
  }

  test("пункт в меню игрока переключается; ход делается один раз за этап, когда становится доступен", async() => {
    const { manager, night, sent } = await inRoom();
    const target = { index: 3, username: "Игрок4", playerObjectId: "p4", alive: true };

    let [entry] = await manager.menuItems("player", target);
    expect(entry!.label).toBe("Авто-клик");
    night(0);                       // первая ночь: у мафии хода нет
    await tick(3);

    manager.selectMenu(entry!, "player", target);
    await tick(5);
    expect(sent()).toHaveLength(0);

    [entry] = await manager.menuItems("player", target);
    expect(entry!.label).toBe("✅ Авто-клик");

    night(1);                       // основная ночь: мафия может убивать
    await tick(6);
    expect(sent()).toHaveLength(1);
    expect(sent()[0]).toMatchObject({ puo: "p4" });

    night(1);                       // тот же этап пришёл снова - второго хода нет
    await tick(6);
    expect(sent()).toHaveLength(1);

    night(3);                       // день, голосование: новый этап - ход снова
    await tick(6);
    expect(sent()).toHaveLength(2);
  });

  test("повторный выбор снимает авто-клик; мёртвому пункта нет", async() => {
    const { manager } = await inRoom();
    const target = { index: 3, username: "Игрок4", playerObjectId: "p4", alive: true };
    const [on] = await manager.menuItems("player", target);
    manager.selectMenu(on!, "player", target);
    await tick(4);
    const [off] = await manager.menuItems("player", target);
    expect(off!.label).toBe("✅ Авто-клик");
    manager.selectMenu(off!, "player", target);
    await tick(4);
    expect((await manager.menuItems("player", target))[0]!.label).toBe("Авто-клик");
    expect(await manager.menuItems("player", { ...target, alive: false })).toEqual([]);
  });
});
