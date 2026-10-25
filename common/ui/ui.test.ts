import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, expect, test } from "bun:test";
import Events from "../utils/emitter";

const nextTick = () => new Promise(resolve => setTimeout(resolve, 0));

// DOM нужен только здесь; он подменяет глобальные Blob и др., поэтому после тестов убираем
let ui: typeof import(".");
let Counter: (props: { title: string }) => unknown;

beforeAll(async() => {
  GlobalRegistrator.register();
  ui = await import(".");
  Counter = (await import("../../dev/Counter.tsrx")).default;
});
afterAll(() => GlobalRegistrator.unregister());

test("tsrx-компонент собирается, реагирует на сигналы и получает scoped-стили", async() => {
  // Solid слушает клики на document, поэтому корень должен быть в документе
  const root = document.body.appendChild(document.createElement("div"));
  const dispose = ui.mount(() => Counter({ title: "Бафия" }) as any, root);

  expect(root.querySelector("h1")?.textContent).toBe("Бафия");
  expect(root.textContent).toContain("Пока мало");

  const button = root.querySelector("button")!;
  for(let i = 0; i < 3; i++) button.click();
  await nextTick();

  expect(button.textContent).toBe("Нажато 3");
  expect(root.textContent).toContain("Уже много");
  expect(button.className).toMatch(/tsrx-/);
  expect(document.head.querySelector("style[data-module]")?.textContent).toContain(".tsrx-");

  dispose();
  expect(root.innerHTML).toBe("");
  root.remove();
});

test("fromEvents не мешает другим подписчикам, даже когда значение равно false", async() => {
  class Source extends Events<{ change: () => void }> { flag = false; other = 1; }
  const source = new Source();
  const seen: number[] = [];

  const dispose = ui.mount(() => {
    const flag = ui.fromEvents(source, "change", () => source.flag);   // раньше возвращал false и обрывал рассылку
    const other = ui.fromEvents(source, "change", () => source.other);
    ui.createEffect(() => { flag(); seen.push(other()); });
    return document.createElement("div");
  }, document.createElement("div"));

  source.other = 2;
  source.emit("change");
  await nextTick();
  expect(seen.at(-1)).toBe(2);
  dispose();
});

test("fromEvents обновляется по событию и отписывается вместе с компонентом", async() => {
  class Source extends Events<{ change: () => void }> { value = 1; }
  const source = new Source();
  const seen: number[] = [];

  const dispose = ui.mount(() => {
    const value = ui.fromEvents(source, "change", () => source.value);
    ui.createEffect(() => seen.push(value()));
    return document.createElement("div");
  }, document.createElement("div"));

  source.value = 2;
  source.emit("change");
  await nextTick();
  expect(seen).toEqual([1, 2]);
  expect(source.listenerCount("change")).toBe(1);

  dispose();
  expect(source.listenerCount("change")).toBe(0);
});

test("редактор темы: ввод меняет тему, неверное значение отклоняется", async() => {
  const { ThemeManager } = await import("./theme");
  const { ThemeEditor } = await import("./theme/ThemeEditor.tsrx");
  const values = new Map<string, string>();
  const theme = new ThemeManager({ style: { setProperty: (name, value) => values.set(name, value), removeProperty: () => {} } });

  const root = document.body.appendChild(document.createElement("div"));
  const dispose = ui.mount(() => ThemeEditor({ theme, dialogs: {} as never }), root);

  const field = [...root.querySelectorAll<HTMLInputElement>("input[type=text]")][0]!;
  field.value = "#123456";
  field.dispatchEvent(new Event("change", { bubbles: true }));
  expect(theme.values.bg).toBe("#123456");

  field.value = "red; evil";
  field.dispatchEvent(new Event("change", { bubbles: true }));
  expect(theme.values.bg).toBe("#123456");
  expect(field.classList.contains("invalid")).toBe(true);

  dispose();
  root.remove();
});

test("рабочий стол: окна рисуются, закрываются кнопкой, в доке появляются и исчезают иконки", async() => {
  const { WindowManager } = await import("../../launcher/windows/manager");
  const { Desktop } = await import("../../launcher/ui/Desktop.tsrx");
  const manager = new WindowManager({ viewport: () => ({ width: 1000, height: 700 }), closeDelay: 0 });

  const root = document.body.appendChild(document.createElement("div"));
  const dispose = ui.mount(() => Desktop({ manager }) as any, root);

  const first = manager.open({ title: "Первое", icon: "🎮" });
  const second = manager.open({ title: "Второе", popup: true });
  await nextTick();

  expect(root.querySelectorAll(".frame")).toHaveLength(2);
  expect(root.querySelector(".title")?.textContent).toBe("Первое");
  expect(root.querySelectorAll(".icon")).toHaveLength(1);

  first.content.textContent = "содержимое игры";
  expect(root.querySelector(".content")?.textContent).toContain("содержимое игры");

  root.querySelector<HTMLElement>(".light.close")!.click();
  await nextTick();
  expect(manager.windows).toEqual([second]);
  expect(root.querySelectorAll(".frame")).toHaveLength(1);
  expect(root.querySelectorAll(".icon")).toHaveLength(0);

  dispose();
  root.remove();
});

test("NavHost: на время перехода живут два экрана, потом один; назад создаёт предыдущий заново", async() => {
  const { Navigator } = await import("./nav/navigator");
  const { NavHost } = await import("./nav/NavHost.tsrx");
  type Routes = { a: {}, b: { n: number } };
  const nav = new Navigator<Routes>();
  const created: string[] = [];
  const screens = {
    a: () => { created.push("a"); return Object.assign(document.createElement("div"), { textContent: "экран A" }); },
    b: ({ params }: { params: { n: number } }) => { created.push("b"); return Object.assign(document.createElement("div"), { textContent: `экран B${params.n}` }); }
  };

  nav.push("a");
  const root = document.body.appendChild(document.createElement("div"));
  const dispose = ui.mount(() => NavHost({ navigator: nav, screens, duration: 30 }) as any, root);
  const layers = () => [...root.querySelectorAll(".layer")].map(layer => `${layer.textContent}|${layer.className.replace(/tsrx-\S+|layer|\s+/g, " ").trim()}`);

  expect(layers()).toEqual(["экран A|"]);

  nav.push("b", { n: 2 });
  await nextTick();
  expect(layers()).toEqual(["экран A|push-out", "экран B2|push-in"]);

  await new Promise(resolve => setTimeout(resolve, 60));
  expect(layers()).toEqual(["экран B2|"]);

  nav.pop();
  await nextTick();
  // предыдущий экран возвращается снизу, уходящий - сверху
  expect(layers()).toEqual(["экран A|pop-in", "экран B2|pop-out"]);

  await new Promise(resolve => setTimeout(resolve, 60));
  expect(layers()).toEqual(["экран A|"]);
  expect(created).toEqual(["a", "b", "a"]);

  // быстрый второй переход доигрывает первый, лишние экраны не копятся
  nav.push("b", { n: 3 });
  nav.push("b", { n: 4 });
  await nextTick();
  expect(layers()).toHaveLength(2);

  dispose();
  root.remove();
});

test("диалоги: сообщение, подтверждение, ввод с проверкой, закрытие по Esc", async() => {
  const { DialogManager, createDialogs } = await import("./dialog/dialogs");
  const { DialogLayer } = await import("./dialog/DialogLayer.tsrx");
  const manager = new DialogManager();
  const dialogs = createDialogs(manager);

  const root = document.body.appendChild(document.createElement("div"));
  const dispose = ui.mount(() => DialogLayer({ manager }) as any, root);
  const click = (label: string) => [...root.querySelectorAll("button")].find(button => button.textContent == label)!.click();

  const confirmation = dialogs.confirm("Удалить?", { yes: "Удалить" });
  await nextTick();
  expect(root.querySelector(".head")?.textContent).toBe("Подтверждение");
  expect(root.textContent).toContain("Удалить?");
  click("Удалить");
  expect(await confirmation).toBe(true);
  await nextTick();
  expect(root.querySelector(".card")).toBeNull();

  const nickname = dialogs.prompt({ title: "Ник", validate: value => value.length < 3 ? "Слишком короткий" : undefined, required: true });
  await nextTick();
  const input = root.querySelector("input")!;
  input.value = "ab";
  root.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  await nextTick();
  expect(root.querySelector(".error")?.textContent).toBe("Слишком короткий");

  // обязательное окно Esc не закрывает
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  expect(manager.isOpen).toBe(true);

  input.value = "abc";
  root.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  expect(await nickname).toBe("abc");

  const optional = dialogs.confirm("Точно?");
  await nextTick();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  expect(await optional).toBe(false);

  dispose();
  root.remove();
});

test("контекстное меню: мышью - у курсора, пальцем - окно с кнопками; выбор, клик мимо и Esc", async() => {
  const { createDialogs, DialogManager } = await import("./dialog/dialogs");
  const { DialogLayer } = await import("./dialog/DialogLayer.tsrx");
  const { MenuLayer } = await import("./menu/MenuLayer.tsrx");
  const dialogs = createDialogs(new DialogManager());

  const root = document.body.appendChild(document.createElement("div"));
  const dispose = ui.mount(() => [MenuLayer({ manager: dialogs.menu }), DialogLayer({ manager: dialogs.manager })] as any, root);
  const labels = ["Зайти", "Скопировать"];

  // правая кнопка мыши: меню рядом с курсором
  const chosen = dialogs.choose(new MouseEvent("contextmenu", { clientX: 40, clientY: 30 }), { title: "Комната", labels });
  await nextTick();
  expect([...root.querySelectorAll(".menu .item")].map(item => item.textContent)).toEqual(labels);
  expect(root.querySelector(".card")).toBeNull();
  root.querySelectorAll<HTMLElement>(".menu .item")[1]!.click();
  expect(await chosen).toBe(1);
  await nextTick();
  expect(root.querySelector(".menu")).toBeNull();

  // клик мимо меню и Esc закрывают без выбора
  const outside = dialogs.choose(new MouseEvent("contextmenu", { clientX: 5, clientY: 5 }), { title: "x", labels });
  await nextTick();
  root.querySelector<HTMLElement>(".shield")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  expect(await outside).toBeUndefined();

  const escaped = dialogs.choose(new MouseEvent("contextmenu"), { title: "x", labels });
  await nextTick();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  expect(await escaped).toBeUndefined();

  // долгое нажатие пальцем (или вызов без события): окно с кнопками
  const touched = dialogs.choose(undefined, { title: "Комната", labels });
  await nextTick();
  expect(root.querySelector(".head")?.textContent).toBe("Комната");
  [...root.querySelectorAll<HTMLElement>(".card button")].find(button => button.textContent == "Зайти")!.click();
  expect(await touched).toBe(0);

  dispose();
  root.remove();
});

test("ErrorBoundary: ошибка при отрисовке уходит в запасной экран, остальное живёт", async() => {
  const Boundary = (await import("../../dev/Boundary.tsrx")).default;
  const root = document.body.appendChild(document.createElement("div"));
  const caught: unknown[] = [];
  const originalError = console.error;
  console.error = () => {};
  const dispose = ui.mount(() => Boundary({ onCatch: (error: unknown) => caught.push(error) }) as any, root);
  console.error = originalError;

  expect(root.querySelector(".outside")?.textContent).toBe("снаружи");
  expect(root.querySelector(".fallback")?.textContent).toBe("запасной экран");
  expect((caught[0] as Error).message).toBe("сломано при отрисовке");

  dispose();
  root.remove();
});
