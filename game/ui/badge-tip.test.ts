import { describe, expect, test } from "bun:test";
import { defaultGameSettings } from "@common/storage/settings";
import { tipActive } from "../domain/tips";
import { BadgeTip } from "./badge-tip";

const settings = () => {
  const data = defaultGameSettings(false);
  return { data, update: (change: (value: typeof data) => void) => change(data) };
};

describe("подсказка про галочку", () => {
  test("показывается один раз и только когда на экране есть галочка; потом больше не появляется", () => {
    const store = settings();
    const tip = new BadgeTip({ settings: store } as never);
    tip.offer(() => false);
    expect(tip.active).toBe(false);
    expect(tipActive(store, "badge")).toBe(true);

    tip.offer(() => true);
    expect(tip.active).toBe(true);
    tip.stop();
    expect(tip.active).toBe(false);
    tip.offer(() => true);
    expect(tip.active).toBe(false);
    expect(tipActive(store, "badge")).toBe(false);
  });

  test("выключенные подсказки не показываются", () => {
    const store = settings();
    store.data.tips.enabled = false;
    const tip = new BadgeTip({ settings: store } as never);
    tip.offer(() => true);
    expect(tip.active).toBe(false);
  });
});
