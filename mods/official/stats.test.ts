import { describe, expect, test } from "bun:test";
import { playerStats, winRateTargets, winsNeededForRate } from "./stats";

describe("статистика игрока", () => {
  test("считает игры по командам и проценты", () => {
    const stats = playerStats({
      playedGames: 100, winsAsMafia: 20, winsAsPeaceful: 30,
      roleStatistics: { 1: 40, 2: 10, 4: 30, 6: 10, 9: 10 }
    });

    expect(stats).toMatchObject({ gamesAsMafia: 50, gamesAsPeaceful: 50, totalWins: 50, winRate: 50, mafiaShareOfWins: 40, peacefulShareOfWins: 60, mafiaWinRate: 40, peacefulWinRate: 60 });
    expect(stats.peacefulToMafiaRatio).toBe(1.5);
  });

  test("у нового игрока нет NaN и деления на ноль", () => {
    const stats = playerStats({ playedGames: 0, winsAsMafia: 0, winsAsPeaceful: 0, roleStatistics: {} });
    expect(stats.winRate).toBeUndefined();
    expect(stats.mafiaShareOfWins).toBeUndefined();
    expect(stats.peacefulToMafiaRatio).toBeUndefined();
    expect(Object.values(stats).some(value => Number.isNaN(value))).toBe(false);
  });

  test("сколько побед нужно до целевого винрейта", () => {
    expect(winsNeededForRate(50, 100, .5)).toBe(0);
    expect(winsNeededForRate(50, 100, .6)).toBe(25);     // (50+25)/(100+25) = 60%
    expect(winsNeededForRate(0, 0, .5)).toBe(1);
    expect(winsNeededForRate(10, 20, 1)).toBe(Infinity); // 100% недостижимо добавлением побед
  });

  test("цели подбираются по текущему винрейту", () => {
    expect(winRateTargets(30)).toEqual([50, 60]);
    expect(winRateTargets(55)).toEqual([55, 60, 70]);
    expect(winRateTargets(92)).toEqual([95, 100]);
  });
});
