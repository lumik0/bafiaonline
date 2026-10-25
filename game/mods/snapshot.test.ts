import { describe, expect, test } from "bun:test";
import { RoomState } from "../domain/room/state";
import { roomSnapshot } from "./snapshot";

function game() {
  const state = new RoomState({ id: "r1", modelType: 1, title: "Тест", minPlayers: 4, maxPlayers: 8, minLevel: 1, vip: false, roles: [] }, "p1");
  state.status = 3;
  state.players = ["Я", "Аня", "Боря", "Витя"].map((username, index) => ({
    index, username, playerObjectId: "p" + (index + 1), alive: true, affectedByRoles: [], vote: 0
  }));
  return state;
}

describe("снимок комнаты для модов", () => {
  test("видно этап, свою роль и союзников, чужие роли скрыты", () => {
    const state = game();
    state.players[0]!.role = 4;
    state.players[1]!.role = 4;
    state.dayTime = 1;

    const snapshot = roomSnapshot(state);
    expect(snapshot).toMatchObject({ phase: "game", time: "night", step: "night", me: { index: 0, role: 4, roleName: "Мафия", alive: true } });
    expect(snapshot.players.map(player => [player.username, player.role, player.mafia, player.action])).toEqual([
      ["Я", 4, true, undefined],
      ["Аня", 4, true, undefined],
      ["Боря", undefined, undefined, "kill"],
      ["Витя", undefined, undefined, "kill"]
    ]);
  });

  test("четыре этапа: 1 ночь, 2 ночь, 1 день, 2 день", () => {
    const state = game();
    const stages = [0, 1, 2, 3].map(dayTime => { state.dayTime = dayTime; const { time, part, step } = roomSnapshot(state); return [time, part, step]; });
    expect(stages).toEqual([["night", 1, "lover"], ["night", 2, "night"], ["day", 1, "bodyguard"], ["day", 2, "vote"]]);
  });

  test("днём голосовать можно за любого живого, кроме себя; мёртвый не ходит", () => {
    const state = game();
    state.players[0]!.role = 1;
    state.dayTime = 3;
    expect(roomSnapshot(state)).toMatchObject({ time: "day", step: "vote" });
    expect(roomSnapshot(state).players.map(player => player.action)).toEqual([undefined, "kill", "kill", "kill"]);

    state.players[2]!.alive = false;
    expect(roomSnapshot(state).players[2]!.action).toBeUndefined();
    state.players[0]!.alive = false;
    expect(roomSnapshot(state).players.every(player => !player.action)).toBe(true);
  });

  test("до игры: только список игроков", () => {
    const state = new RoomState({ id: "r1", modelType: 1, title: "Т", minPlayers: 4, maxPlayers: 8, minLevel: 1, vip: false, roles: [] }, "p1");
    state.lobby = [{ playerObjectId: "p1", username: "Я" }, { playerObjectId: "p2", username: "Аня" }];
    const snapshot = roomSnapshot(state);
    expect(snapshot).toMatchObject({ phase: "registration", time: undefined, me: undefined });
    expect(snapshot.players.map(player => player.username)).toEqual(["Я", "Аня"]);
  });
});
