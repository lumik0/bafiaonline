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
