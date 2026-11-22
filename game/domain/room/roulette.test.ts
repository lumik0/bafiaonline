import { describe, expect, test } from "bun:test";
import { rouletteChain } from "./roulette";

describe("rouletteChain", () => {
  const p = (id: string, alive = true) => ({ playerObjectId: id, username: `игрок ${id}`, alive });
  test("мёртвые и хост пропускаются, круг замыкается", () => {
    expect(rouletteChain([p("h"), p("1"), p("2", false), p("3")], "h")).toBe("[игрок 1] => [игрок 3] => [игрок 1]");
  });
  test("меньше двух живых - пусто", () => {
    expect(rouletteChain([p("h"), p("1")], "h")).toBe("");
  });
});
