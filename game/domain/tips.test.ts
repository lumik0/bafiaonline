import { describe, expect, test } from "bun:test";
import { claimsSheriff, completeTip, MAX_TIP_SHOWS, markTipShown, resetTips, sheriffClaimTarget, tipActive } from "./tips";
import { defaultGameSettings } from "@common/storage/settings";
import type { GamePlayer } from "./room/state";

const settings = () => {
  const data = defaultGameSettings(false);
  return { data, update: (change: (value: typeof data) => void) => change(data) };
};
const player = (extra: Partial<GamePlayer> = {}) => ({ playerObjectId: "p1", username: "Вася", alive: true, role: 0, ...extra }) as GamePlayer;

describe("подсказки", () => {
  test("слова шер и шериф целиком, в любом регистре", () => {
    for(const text of ["Я шер", "я шер чек Вася маф", "ШЕРИФ тут", "шерифа проверяйте", "я шериф, чекнул 3 - мир"]) expect(claimsSheriff(text)).toBe(true);
    for(const text of ["шерсть", "шершавый", "ашер", "привет", "шериффф"]) expect(claimsSheriff(text)).toBe(false);
  });

  test("цель: живой чужой игрок с неизвестной ролью, ещё не отмеченный шерифом", () => {
    expect(sheriffClaimTarget("я шер", player(), "me")).toBe("p1");
    expect(sheriffClaimTarget("я шер", player(), "p1")).toBeUndefined();
    expect(sheriffClaimTarget("я шер", player({ alive: false }), "me")).toBeUndefined();
    expect(sheriffClaimTarget("я шер", player({ role: 3 }), "me")).toBeUndefined();
    expect(sheriffClaimTarget("я шер", player({ preRole: 3 }), "me")).toBeUndefined();
    expect(sheriffClaimTarget("я шер", undefined, "me")).toBeUndefined();
    expect(sheriffClaimTarget("привет", player(), "me")).toBeUndefined();
    // отмечен другой ролью - подсказка всё ещё уместна: игрок сам решит
    expect(sheriffClaimTarget("я шер", player({ preRole: 5 }), "me")).toBe("p1");
  });

  test("выполненная подсказка не возвращается, надоедать после нескольких показов перестаём, сброс возвращает", () => {
    const store = settings();
    expect(tipActive(store, "markRole")).toBe(true);
    for(let i = 0; i < MAX_TIP_SHOWS; i++) markTipShown(store, "markRole");
    expect(tipActive(store, "markRole")).toBe(false);
    resetTips(store);
    expect(tipActive(store, "markRole")).toBe(true);
    completeTip(store, "markRole");
    completeTip(store, "markRole");
    expect(store.data.tips.done).toEqual(["markRole"]);
    expect(tipActive(store, "markRole")).toBe(false);
    resetTips(store);
    store.data.tips.enabled = false;
    expect(tipActive(store, "markRole")).toBe(false);
  });
});
