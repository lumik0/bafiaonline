import { describe, expect, test } from "bun:test";
import { MemoryFileStore } from "../../storage/files";
import { presets, ThemeManager, tokens, isValidValue, type StyleTarget } from ".";

function fakeTarget() {
  const vars = new Map<string, string>();
  const writes: string[] = [];
  const target: StyleTarget = {
    style: {
      setProperty(name, value) { vars.set(name, value); writes.push(name); },
      removeProperty(name) { vars.delete(name); }
    }
  };
  return { target, vars, writes };
}

describe("ThemeManager", () => {
  test("при создании применяет все токены выбранного пресета", () => {
    const { target, vars } = fakeTarget();
    new ThemeManager(target);
    expect(vars.size).toBe(tokens.length);
    expect(vars.get("--button-bg")).toBe("#d03a41");
  });

  test("правки принадлежат своей теме и не переходят в другую", () => {
    const { target, vars } = fakeTarget();
    const theme = new ThemeManager(target);

    theme.set("button-bg", "#00ff00");
    expect(vars.get("--button-bg")).toBe("#00ff00");

    theme.select("midnight");
    expect(vars.get("--button-bg")).toBe(presets.find(p => p.id == "midnight")!.values["button-bg"]);
    expect(vars.get("--bg")).toBe("#0b0d14");

    theme.select("classic");
    expect(vars.get("--button-bg")).toBe("#00ff00");
    theme.reset("button-bg");
    expect(vars.get("--button-bg")).toBe("#d03a41");
  });

  test("своя тема: создаётся как классика, выбирается, удаляется", () => {
    const { target, vars } = fakeTarget();
    const theme = new ThemeManager(target);
    theme.set("accent", "#111111");

    const id = theme.create("Моя");
    expect(theme.active).toBe(id);
    expect(theme.themes.map(item => item.name)).toEqual(["Классика", "Полночь", "Хэллоуин", "Моя"]);
    expect(vars.get("--accent")).toBe("#d03a41");

    theme.set("accent", "#222222");
    theme.select("classic");
    expect(vars.get("--accent")).toBe("#111111");

    expect(theme.rename(id, "Другая")).toBe(true);
    theme.select(id);
    expect(theme.remove(id)).toBe(true);
    expect(theme.active).toBe("classic");
    expect(theme.themes).toHaveLength(3);
  });

  test("встроенные темы не удаляются и не переименовываются, но настраиваются", () => {
    const theme = new ThemeManager(fakeTarget().target);
    expect(theme.remove("classic")).toBe(false);
    expect(theme.remove("midnight")).toBe(false);
    expect(theme.remove("halloween")).toBe(false);
    expect(theme.rename("midnight", "Х")).toBe(false);
    expect(theme.themes.every(item => item.builtIn)).toBe(true);

    theme.select("midnight");
    expect(theme.set("accent", "#abcdef")).toBe(true);
    expect(theme.values.accent).toBe("#abcdef");
  });

  test("меняются только изменившиеся переменные", () => {
    const { target, writes } = fakeTarget();
    const theme = new ThemeManager(target);
    writes.length = 0;

    theme.set("chat-text", "#123456");
    expect(writes).toEqual(["--chat-text"]);
  });

  test("в переменные не попадает ничего, кроме цветов и размеров", () => {
    const { target, vars } = fakeTarget();
    const theme = new ThemeManager(target);

    expect(theme.set("button-bg", "red; background: url(//evil)")).toBe(false);
    expect(theme.set("button-radius", "10px; x:y")).toBe(false);
    // @ts-expect-error такого токена нет
    expect(theme.set("не-токен", "#fff")).toBe(false);
    expect(vars.get("--button-bg")).toBe("#d03a41");
    expect(isValidValue("color", "rgba(0, 0, 0, .5)")).toBe(true);
    expect(isValidValue("size", "12px")).toBe(true);
  });

  test("темы сохраняются в файл и читаются обратно", async() => {
    const files = new MemoryFileStore();
    const first = new ThemeManager(fakeTarget().target, files);
    const id = first.create("Моя");
    first.set("chat-text", "#112233");
    first.select("midnight");
    first.set("accent", "#445566");
    await first.flush();

    const { target, vars } = fakeTarget();
    const second = new ThemeManager(target, files);
    await second.load();

    expect(second.active).toBe("midnight");
    expect(vars.get("--accent")).toBe("#445566");
    second.select(id);
    expect(vars.get("--chat-text")).toBe("#112233");
  });

  test("файл первой версии: правки остаются, «Светлая» становится классикой", async() => {
    const files = new MemoryFileStore();
    await files.write("/theme.json", JSON.stringify({ version: 1, preset: "midnight", overrides: { accent: "#123456" } }));
    const midnight = new ThemeManager(fakeTarget().target, files);
    await midnight.load();
    expect(midnight.active).toBe("midnight");
    expect(midnight.values.accent).toBe("#123456");

    await files.write("/theme.json", JSON.stringify({ version: 1, preset: "light", overrides: { text: "#abcdef" } }));
    const light = new ThemeManager(fakeTarget().target, files);
    await light.load();
    expect(light.active).toBe("classic");
    expect(light.values.text).toBe("#abcdef");
  });

  test("испорченный файл темы не ломает запуск", async() => {
    const files = new MemoryFileStore();
    await files.write("/theme.json", JSON.stringify({ version: 2, active: "нет такой", themes: [
      { id: "classic", overrides: { "button-bg": "javascript:1", "неизвестный": "#fff", "text": "#abcdef" } },
      { id: "x", name: "  ", base: "light", overrides: {} }, 5, null
    ] }));

    const theme = new ThemeManager(fakeTarget().target, files);
    await theme.load();

    expect(theme.active).toBe("classic");
    expect(theme.overrides).toEqual({ "text": "#abcdef" });
    expect(theme.themes.map(item => item.name)).toEqual(["Классика", "Полночь", "Хэллоуин", "Тема"]);
  });

  test("экспорт и импорт переносят тему между игроками: она добавляется как новая", () => {
    const a = new ThemeManager(fakeTarget().target);
    a.create("Красивая");
    a.set("accent", "#ff00aa");

    const b = new ThemeManager(fakeTarget().target);
    expect(b.importJson(a.exportJson())).toBe(1);
    expect(b.themes.map(item => item.name)).toEqual(["Классика", "Полночь", "Хэллоуин", "Красивая"]);
    expect(b.values.accent).toBe("#ff00aa");
    expect(b.overrides).toEqual({ accent: "#ff00aa" });
    expect(() => b.importJson("{}")).toThrow("не файл темы");
  });

  test("эффект: у Хэллоуина свой, остальным можно выбрать; сохраняется и экспортируется", async() => {
    const files = new MemoryFileStore();
    const theme = new ThemeManager(fakeTarget().target, files);
    expect(theme.effect).toBe("none");
    theme.select("halloween");
    expect(theme.effect).toBe("halloween");
    expect(theme.values.accent).toBe("#ff7a1a");

    expect(theme.setEffect("нет такого")).toBe(false);
    theme.setEffect("none");
    expect(theme.effect).toBe("none");
    theme.select("classic");
    theme.setEffect("halloween");
    await theme.flush();

    const other = new ThemeManager(fakeTarget().target, files);
    await other.load();
    expect(other.effect).toBe("halloween");
    other.select("halloween");
    expect(other.effect).toBe("none");

    const imported = new ThemeManager(fakeTarget().target);
    imported.importJson(theme.exportJson());
    expect(imported.effect).toBe("halloween");
  });

  test("временный слой перекрывает тему, не сохраняется и снимается", async() => {
    const files = new MemoryFileStore();
    const { target, vars } = fakeTarget();
    const theme = new ThemeManager(target, files);

    theme.setLayer("mod", { accent: "#00ff00", "button-bg": "javascript:1", неизвестный: "#fff" });
    expect(vars.get("--accent")).toBe("#00ff00");
    expect(vars.get("--button-bg")).toBe("#d03a41");
    await theme.flush();
    expect(await files.read("/theme.json")).not.toContain("#00ff00");

    theme.setLayer("mod");
    expect(vars.get("--accent")).toBe("#d03a41");
  });
});
