import { describe, expect, test } from "bun:test";
import { installedShell, releasedShell, shellUpdateAvailable } from "./shell";

describe("обновление оболочки", () => {
  test("номер из версии приложения и из описания релиза", () => {
    expect(installedShell("2.4.13+s2")).toBe(2);
    expect(installedShell("2.4.13")).toBe(0);
    expect(installedShell(undefined)).toBe(0);
    expect(releasedShell("Android: версия 2.4.14, сборка 20. Оболочка: 3. Игра внутри")).toBe(3);
    expect(releasedShell("без номера")).toBeUndefined();
  });

  test("предлагаем только если в релизе новее; сбой и отсутствие номера - не предлагаем", async() => {
    expect(await shellUpdateAvailable(0, async() => "Оболочка: 1")).toBe(true);
    expect(await shellUpdateAvailable(1, async() => "Оболочка: 1")).toBe(false);
    expect(await shellUpdateAvailable(0, async() => "нет")).toBe(false);
    expect(await shellUpdateAvailable(0, async() => { throw new Error("сеть"); })).toBe(false);
  });
});
