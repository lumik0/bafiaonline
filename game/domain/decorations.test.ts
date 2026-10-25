import { describe, expect, test } from "bun:test";
import { animationOf, decorationColor, nickStyle, readableOn, normalizeDecorations, parseAlpha, photoRing, profileColors } from "./decorations";

describe("украшения игрока", () => {
  test("приводит присланное к виду «тип → параметры → строка», мусор отбрасывает", () => {
    expect(normalizeDecorations({ "3": { "1": "#FFCE90F7", "0": 0.5 }, "9": "не объект", "1": { "1": { вложенный: 1 } } })).toEqual({ "3": { "1": "#FFCE90F7", "0": "0.5" }, "1": {} });
    expect(normalizeDecorations(undefined)).toBeUndefined();
    expect(normalizeDecorations([])).toBeUndefined();
    expect(normalizeDecorations({})).toBeUndefined();
  });

  test("цвет и прозрачность: #AARRGGBB, отдельный параметр прозрачности в трёх записях", () => {
    expect(decorationColor({ "1": "#FFCE90F7" })).toBe("#CE90F7FF");
    expect(decorationColor({ "1": "#FFCE90F7", "0": "50" })).toBe("#CE90F7FF");       // у цвета уже есть своя прозрачность
    expect(decorationColor({ "1": "#CE90F7", "0": "50" })).toBe("#CE90F780");
    expect(decorationColor({ "1": "#CE90F7", "0": "100" })).toBe("#CE90F7ff");
    expect(decorationColor({ "2": "файл.json" })).toBeUndefined();
    expect(parseAlpha("мусор")).toBeUndefined();
  });

  test("ник: цвет текста, фон и тень; фото: рамка; профиль: фон и основной цвет", () => {
    const decorations = {
      "3": { "1": "#FFFF0000" }, "1": { "1": "#80FFFFFF" }, "2": { "1": "#FF00FF00" }, "8": { "1": "#FF0000FF" },
      "6": { "1": "#FF101010" }, "5": { "1": "#FFD03A41" }
    };
    expect(nickStyle(decorations)).toEqual({
      color: "#FF0000FF",
      background: "#FFFFFF80", "border-radius": "6px", padding: "0 6px",
      "text-shadow": "0 0 3px #00FF00FF, 0 0 7px #00FF00FF"
    });
    expect(photoRing(decorations)).toBe("0 0 0 3px #0000FFFF");
    expect(profileColors(decorations)).toEqual({ background: "#101010FF", main: "#D03A41FF" });

    expect(nickStyle(undefined)).toEqual({});
    expect(photoRing({ "0": { "2": "анимация.json" } })).toBeUndefined();
  });

  test("текст на тёмном фоне светлый, на светлом тёмный; нет фона - обычный", () => {
    expect(readableOn("#2A1340FF")).toBe("#f2f2f2");
    expect(readableOn("#FFFFFFFF")).toBe("#121212");
    expect(readableOn("#00000040")).toBe("#121212");     // почти прозрачный чёрный на светлой подложке
    expect(readableOn(undefined)).toBe("#121212");
  });

  test("анимация: адрес по типу, скорость и прозрачность в процентах, без файла или с путём - нет", () => {
    const decorations = { "0": { "2": "fire.json", "3": "150", "0": "80", "1": "#FF00FF00" }, "4": { "2": "../x.json" }, "7": { "2": "ring.json" } };
    expect(animationOf(decorations, 0)).toEqual({ url: "https://dottap.com/mafia/username_animations/fire.json", path: "animations/username_animations/fire.json", color: "#00FF00FF", speed: 1.5, alpha: .8 });
    expect(animationOf(decorations, 7)?.url).toBe("https://dottap.com/mafia/profile_animations/ring.json");
    expect(animationOf(decorations, 7)).toMatchObject({ speed: 1, alpha: 1 });
    expect(animationOf(decorations, 4)).toBeUndefined();
    expect(animationOf(undefined, 0)).toBeUndefined();
  });
});
