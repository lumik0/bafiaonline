import { describe, expect, test } from "bun:test";
import { clampPosition, resizeBounds } from "./geometry";
import { WindowManager } from "./manager";

const viewport = { width: 1000, height: 700 };
const create = (options: ConstructorParameters<typeof WindowManager>[0] = {}) =>
  new WindowManager({ viewport: () => viewport, closeDelay: 0, ...options });

describe("геометрия", () => {
  test("окно нельзя утащить так, чтобы за него нельзя было ухватиться", () => {
    const bounds = { x: 0, y: 0, width: 400, height: 300 };
    expect(clampPosition({ ...bounds, x: 5000, y: 5000 }, viewport)).toEqual({ x: 920, y: 670 });
    expect(clampPosition({ ...bounds, x: -5000, y: -50 }, viewport)).toEqual({ x: -320, y: 0 });
  });

  test("при растягивании за левый край достигнув минимума окно не сдвигается", () => {
    const start = { x: 100, y: 100, width: 300, height: 200 };
    const resized = resizeBounds(start, "w", 250, 0, { width: 120, height: 100 });
    expect(resized).toEqual({ x: 280, y: 100, width: 120, height: 200 });
    // правый край остался на месте
    expect(resized.x + resized.width).toBe(start.x + start.width);
  });
});

describe("WindowManager", () => {
  test("активное окно - верхнее из не свёрнутых; фокус поднимает окно", () => {
    const manager = create();
    const a = manager.open({ title: "A" });
    const b = manager.open({ title: "B" });
    expect(manager.active).toBe(b);

    a.focus();
    expect(manager.active).toBe(a);
    expect(manager.zIndex(a)).toBeGreaterThan(manager.zIndex(b));

    a.minimize();
    expect(manager.active).toBe(b);
    a.restore();
    expect(manager.active).toBe(a);
    expect(a.minimized).toBe(false);
  });

  test("фокус меняет только z-порядок, а список окон остаётся в порядке открытия (иначе перерисовка перезапускает анимации)", () => {
    const manager = create();
    const a = manager.open();
    const b = manager.open();
    const c = manager.open();

    a.focus();
    c.focus();
    b.focus();

    expect(manager.windows).toEqual([a, b, c]);
    expect([a, b, c].map(window => manager.zIndex(window))).toEqual([0, 2, 1]);
  });

  test("развернуть и вернуть: размер и место восстанавливаются", () => {
    const manager = create();
    const window = manager.open({ x: 50, y: 60, width: 400, height: 300 });

    window.toggleMaximize();
    expect(window.bounds).toEqual({ x: 0, y: 0, ...viewport });
    expect(manager.hasMaximized).toBe(true);

    window.toggleMaximize();
    expect(window.bounds).toEqual({ x: 50, y: 60, width: 400, height: 300 });
    expect(manager.hasMaximized).toBe(false);
  });

  test("свёрнутое развёрнутое окно возвращается развёрнутым", () => {
    const manager = create();
    const window = manager.open();
    window.toggleMaximize();
    window.minimize();
    window.restore();
    expect(window.maximized).toBe(true);
  });

  test("закрытие можно отменить, но force отменить нельзя", async() => {
    const manager = create();
    const window = manager.open();
    window.on("beforeClose", event => { event.isCancelled = true; });

    expect(await window.close()).toBe(false);
    expect(manager.windows).toContain(window);

    expect(await window.close(true)).toBe(true);
    expect(manager.windows).not.toContain(window);
    expect(window.alive).toBe(false);
  });

  test("close даёт знать и окну, и менеджеру, и повторно не срабатывает", async() => {
    const manager = create();
    const window = manager.open();
    const log: string[] = [];
    window.on("close", () => log.push("window"));
    manager.on("close", () => log.push("manager"));

    await window.close();
    await window.close();
    expect(log).toEqual(["window", "manager"]);
  });

  test("на телефоне окна на весь экран, а попапы нет и в док не попадают", () => {
    const manager = create({ mobile: true });
    const full = manager.open({ width: 300, height: 200 });
    const popup = manager.open({ width: 300, height: 200, popup: true });

    expect(full.bounds).toEqual({ x: 0, y: 0, ...viewport });
    expect(full.options.movable || full.options.resizable || full.options.titleBar).toBe(false);
    expect(popup.bounds.width).toBe(300);
    expect(popup.showInDock).toBe(false);
  });

  test("окно не больше экрана и открывается по центру по запросу", () => {
    const manager = create();
    const window = manager.open({ width: 5000, height: 200, center: true });
    expect(window.bounds).toEqual({ x: 0, y: 250, width: 1000, height: 200 });
  });

  test("при изменении размера страницы развёрнутые окна подстраиваются, остальные остаются в пределах экрана", () => {
    let size = { ...viewport };
    const manager = new WindowManager({ viewport: () => size, closeDelay: 0 });
    const maximized = manager.open();
    maximized.toggleMaximize();
    const normal = manager.open({ x: 900, y: 600, width: 300, height: 200 });

    size = { width: 500, height: 400 };
    manager.viewportChanged();

    expect(maximized.bounds).toEqual({ x: 0, y: 0, width: 500, height: 400 });
    expect(normal.bounds.x).toBeLessThanOrEqual(420);
    expect(normal.bounds.y).toBeLessThanOrEqual(370);
  });

  test("новые окна открываются над доком: высота и центр считаются без нижней полосы", () => {
    const manager = create({ reserveBottom: () => 100 });
    const window = manager.open({ width: 400, height: 5000, center: true });
    expect(window.bounds).toEqual({ x: 300, y: 0, width: 400, height: 600 });

    // развёрнутое окно занимает всё: док прячется сам
    window.toggleMaximize();
    expect(window.bounds.height).toBe(700);
  });

  test("масштаб интерфейса: развёрнутые окна подстраиваются под новые размеры рабочего стола", () => {
    let scale = 1;
    const manager = new WindowManager({ viewport: () => ({ width: 1000 / scale, height: 700 / scale }), scale, closeDelay: 0 });
    const window = manager.open();
    window.toggleMaximize();

    scale = 2;
    manager.setScale(2);
    expect(manager.scale).toBe(2);
    expect(window.bounds).toEqual({ x: 0, y: 0, width: 500, height: 350 });
  });

  test("окна «всегда сверху» выше остальных, но не считаются активными", () => {
    const manager = create();
    const top = manager.open({ alwaysOnTop: true });
    const normal = manager.open();
    normal.focus();
    expect(manager.zIndex(top)).toBeGreaterThan(manager.zIndex(normal));
    expect(manager.active).toBe(normal);
  });
});
