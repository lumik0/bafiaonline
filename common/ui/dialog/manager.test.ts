import { describe, expect, test } from "bun:test";
import { DialogManager } from "./manager";

describe("DialogManager", () => {
  test("open возвращает значение, с которым закрыли окно", async() => {
    const manager = new DialogManager();
    const result = manager.open<string>({ render: () => null });

    expect(manager.isOpen).toBe(true);
    manager.entries[0]!.close("готово");
    expect(await result).toBe("готово");
    expect(manager.isOpen).toBe(false);
  });

  test("dismissTop закрывает только верхнее окно и только если его можно закрывать", async() => {
    const manager = new DialogManager();
    const first = manager.open({ render: () => null });
    const second = manager.open({ render: () => null, dismissable: false });

    expect(manager.dismissTop()).toBe(true);   // жест «назад» поглощён окном
    expect(manager.entries).toHaveLength(2);   // но закрыть его нельзя

    manager.closeAll();
    expect(await second).toBeUndefined();
    expect(await first).toBeUndefined();
    expect(manager.dismissTop()).toBe(false);  // окон нет - «назад» идёт навигатору
  });

  test("повторное закрытие ничего не меняет", async() => {
    const manager = new DialogManager();
    const result = manager.open<number>({ render: () => null });
    const entry = manager.entries[0]!;
    entry.close(1);
    entry.close(2);
    expect(await result).toBe(1);
  });
});
