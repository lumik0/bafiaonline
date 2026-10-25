import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, expect, test } from "bun:test";
import Events from "@common/utils/emitter";

// DOM нужен только здесь; после тестов убираем
let ui: typeof import("@common/ui");
let PlayersPanel: (props: Record<string, unknown>) => unknown;
let ChatView: (props: Record<string, unknown>) => unknown;
let GifPicker: (props: Record<string, unknown>) => unknown;
let Assets: typeof import("@common/assets").Assets;
let MemoryFileStore: typeof import("@common/storage").MemoryFileStore;

beforeAll(async() => {
  GlobalRegistrator.register();
  // компоненты общие для тестов, а DOM у каждого файла свой: привязываем клики к текущему
  (await import("solid-js/web")).delegateEvents(["click", "input", "change"]);
  ui = await import("@common/ui");
  ({ PlayersPanel } = await import("./PlayersPanel.tsrx") as never);
  ({ ChatView } = await import("./ChatView.tsrx") as never);
  ({ GifPicker } = await import("./GifPicker.tsrx") as never);
  ({ Assets } = await import("@common/assets"));
  ({ MemoryFileStore } = await import("@common/storage"));
});
afterAll(() => GlobalRegistrator.unregister());

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

/** игрок с премиумом: у него значок и рамка вокруг ника в его цвете, у остальных обычный вид */
test("премиум Бафии: цветной значок в списке игроков, значок и рамка у ника в чате", async() => {
  const assets = new Assets(new MemoryFileStore(), { createUrl: () => "blob:test" });
  const bafia = Object.assign(new Events<{ change: () => void }>(), { premiumColor: (id: string) => id == "p1" ? "#3E63DD" : undefined, enabled: true });
  const root = document.body.appendChild(document.createElement("div"));
  const users = [{ username: "Звезда", playerObjectId: "p1" }, { username: "Обычный", playerObjectId: "p2" }];

  const dispose = ui.mount(() => PlayersPanel({
    users: () => users, myName: () => "я", hideName: () => false, assets, mention: () => {}, profile: () => {},
    inBafia: () => true, badgeColor: (id: string) => bafia.premiumColor(id)
  }) as never, root);
  const badges = [...root.querySelectorAll<HTMLElement>(".bafia")];
  expect(badges).toHaveLength(2);
  expect(badges[0]!.style.background).toMatch(/#3E63DD|rgb\(62, 99, 221\)/i);
  expect(badges[1]!.style.background).toBe("");
  dispose();

  const entries = [{ id: 1, kind: "message" as const, text: "привет", user: users[0] }, { id: 2, kind: "message" as const, text: "ку", user: users[1] }];
  const disposeChat = ui.mount(() => ChatView({
    entries: () => entries, myName: () => "я", hideName: () => false, assets, send: () => {}, bafia: bafia as never, readonly: true
  } as never) as never, root);
  await tick();
  const nicks = [...root.querySelectorAll<HTMLElement>(".nick")];
  expect(nicks[0]!.style.border).toMatch(/#3E63DD|rgb\(62, 99, 221\)/i);
  expect(nicks[0]!.querySelector(".pbadge")).not.toBeNull();
  expect(nicks[1]!.style.border).toBe("");
  expect(nicks[1]!.querySelector(".pbadge")).toBeNull();
  disposeChat();
  root.remove();
});

test("панель гифок: без премиума кнопка «Добавить» объясняет и даёт ссылку на бота; вкладка «Мои» только у премиума", async() => {
  const calls: string[] = [];
  const bafia = Object.assign(new Events<{ change: () => void }>(), { premiumUntil: undefined as number | undefined, gifs: async(_query: string, source: string) => { calls.push(source); return []; } });
  const root = document.body.appendChild(document.createElement("div"));
  const dispose = ui.mount(() => GifPicker({ bafia, pick: () => {} }) as never, root);
  await tick();
  expect(calls).toEqual(["giphy"]);
  const tab = (name: string) => [...root.querySelectorAll("button")].find(button => button.textContent == name);
  expect(tab("Мои")).toBeUndefined();

  tab("Бафия")!.click();
  await tick();
  expect(calls).toEqual(["giphy", "bafia"]);
  tab("+ Добавить")!.click();
  await tick();
  expect(root.querySelector(".status")?.textContent).toContain("премиумом");
  expect(root.querySelector<HTMLAnchorElement>(".status a")?.href).toBe("https://t.me/bafiaonlineopt_bot");

  bafia.premiumUntil = Date.now() + 1000;
  bafia.emit("change");
  await tick();
  expect(tab("Мои")).toBeDefined();
  dispose();
  root.remove();
});
