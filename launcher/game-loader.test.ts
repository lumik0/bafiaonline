import { describe, expect, test } from "bun:test";
import { loadGame, type GameGlobals } from "./game-loader";

/** поддельная загрузка скриптов: каждый адрес «выполняется» и кладёт в globals то, что для него задано */
function setup(served: (src: string) => { version?: string } | undefined) {
  const globals: GameGlobals = {};
  const loaded: string[] = [];
  const warnings: string[] = [];
  const load = async(src: string) => {
    loaded.push(src);
    const result = served(src);
    if(!result) return;
    globals.game = async() => {};
    if(result.version) globals.version = result.version; else delete globals.version;
  };
  const run = (expected = "2.1.4") => loadGame({ globals, load, src: "./play/bin/game.js?v=abc", expected, now: () => 111, warn: message => void warnings.push(message) });
  return { globals, loaded, warnings, run };
}

describe("загрузка игры и сверка версий", () => {
  test("версия игры совпала с версией лаунчера: игра грузится один раз с меткой сборки", async() => {
    const { loaded, run } = setup(() => ({ version: "2.1.4" }));
    expect(await run()).toBe("2.1.4");
    expect(loaded).toEqual(["./play/bin/game.js?v=abc"]);
  });

  test("из кэша взялась старая игра (без версии или с другой): загружаем заново мимо кэша и запускаем новую", async() => {
    for(const stale of [undefined, "2.1.3"]) {
      const { loaded, warnings, run } = setup(src => ({ version: src.includes("t=111") ? "2.1.4" : stale }));
      expect(await run()).toBe("2.1.4");
      expect(loaded).toEqual(["./play/bin/game.js?v=abc", "./play/bin/game.js?v=abc&t=111"]);
      expect(warnings).toEqual([]);
    }
  });

  test("и после перезагрузки версия не та: игра всё равно запускается, а расхождение попадает в журнал", async() => {
    const { warnings, run } = setup(() => ({ version: "2.1.3" }));
    expect(await run()).toBe("2.1.3");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("2.1.3");
    expect(warnings[0]).toContain("2.1.4");
  });

  test("игра уже загружена и версия верная (второе окно): скрипт не грузится", async() => {
    const { globals, loaded, run } = setup(() => ({ version: "2.1.4" }));
    await run();
    loaded.length = 0;
    await run();
    expect(loaded).toEqual([]);
    expect(globals.game).toBeDefined();
  });

  test("без метки сборки в адресе (запуск с диска) параметр добавляется через ?; игра без функции запуска - понятная ошибка", async() => {
    const globals: GameGlobals = {};
    const loaded: string[] = [];
    await expect(loadGame({ globals, load: async src => void loaded.push(src), src: "./play/bin/game.js", expected: "2.1.4", now: () => 5 })).rejects.toThrow("нет функции запуска");
    expect(loaded).toEqual(["./play/bin/game.js", "./play/bin/game.js?t=5"]);
  });
});
