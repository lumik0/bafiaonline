import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, expect, test } from "bun:test";

let ui: typeof import("@common/ui");
let NotificationLayer: (props: Record<string, unknown>) => unknown;
let NotificationCenter: typeof import("./center").NotificationCenter;

beforeAll(async() => {
  GlobalRegistrator.register();
  (await import("solid-js/web")).delegateEvents(["click", "input", "change"]);
  ui = await import("@common/ui");
  ({ NotificationLayer } = await import("./NotificationLayer.tsrx") as never);
  ({ NotificationCenter } = await import("./center"));
});
afterAll(() => GlobalRegistrator.unregister());

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test("плашка с ответом: кнопка «Ответить» открывает поле, плашка не исчезает, отправка закрывает её, ошибка остаётся в поле", async() => {
  const clock = { timers: [] as (() => void)[] };
  const center = new NotificationCenter({ set: callback => clock.timers.push(callback), clear: () => {} });
  const root = document.body.appendChild(document.createElement("div"));
  const dispose = ui.mount(() => NotificationLayer({ center }) as never, root);
  const sent: string[] = [];
  let error: string | undefined = "Сервер недоступен";
  center.show({ key: "notice", title: "Сообщение", text: "Вышла версия", timeout: 40_000, reply: { send: async text => { sent.push(text); return error; } } });
  await tick();

  const banner = () => root.querySelector<HTMLElement>(".banner")!;
  const button = root.querySelector<HTMLButtonElement>(".reply-btn")!;
  expect(button.textContent).toBe("Ответить");
  button.click();
  await tick();
  expect(root.querySelector(".composer")).not.toBeNull();
  banner().click();                       // нажатие по плашке во время ответа её не закрывает
  await tick();
  expect(center.items).toHaveLength(1);

  const area = root.querySelector<HTMLTextAreaElement>("textarea")!;
  area.value = "Спасибо";
  area.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  root.querySelector<HTMLButtonElement>(".primary")!.click();
  await tick(); await tick();
  expect(sent).toEqual(["Спасибо"]);
  expect(root.querySelector(".problem")!.textContent).toBe("Сервер недоступен");
  expect(center.items).toHaveLength(1);

  error = undefined;
  root.querySelector<HTMLButtonElement>(".primary")!.click();
  await tick(); await tick();
  expect(sent).toEqual(["Спасибо", "Спасибо"]);
  expect(center.items.map(item => item.title)).toEqual(["Ответ отправлен"]);
  dispose();
});

test("плашка с действием: нажатие выполняет его и закрывает плашку; обычная плашка просто закрывается", async() => {
  const center = new NotificationCenter();
  const root = document.body.appendChild(document.createElement("div"));
  const dispose = ui.mount(() => NotificationLayer({ center }) as never, root);
  let updated = 0;
  center.show({ key: "update", title: "Вышла новая версия", text: "Нажми сюда", timeout: 0, action: () => { updated++; } });
  center.show({ key: "plain", title: "Просто сообщение", timeout: 0 });
  await tick();

  const banners = () => [...root.querySelectorAll<HTMLElement>(".banner")];
  expect(banners()).toHaveLength(2);
  expect(banners().filter(banner => banner.classList.contains("action"))).toHaveLength(1);

  banners().find(banner => banner.textContent?.includes("Просто сообщение"))!.click();
  await tick();
  expect(updated).toBe(0);
  expect(banners()).toHaveLength(1);

  banners()[0]!.click();
  await tick();
  expect(updated).toBe(1);
  expect(banners()).toHaveLength(0);
  dispose();
  root.remove();
});
