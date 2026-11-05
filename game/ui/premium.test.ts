import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import Events from "@common/utils/emitter";

// DOM нужен только здесь; после тестов убираем
let ui: typeof import("@common/ui");
let PlayersPanel: (props: Record<string, unknown>) => unknown;
let ChatView: (props: Record<string, unknown>) => unknown;
let GifPicker: (props: Record<string, unknown>) => unknown;
let GifMessage: (props: Record<string, unknown>) => unknown;
let Assets: typeof import("@common/assets").Assets;
let MemoryFileStore: typeof import("@common/storage").MemoryFileStore;

beforeAll(async() => {
  GlobalRegistrator.register();
  // компоненты общие для тестов, а DOM у каждого файла свой: привязываем клики к текущему
  (await import("solid-js/web")).delegateEvents(["click", "input", "change", "contextmenu", "pointerdown", "pointermove", "pointerup"]);
  ui = await import("@common/ui");
  ({ PlayersPanel } = await import("./PlayersPanel.tsrx") as never);
  ({ ChatView } = await import("./ChatView.tsrx") as never);
  ({ GifPicker } = await import("./GifPicker.tsrx") as never);
  ({ GifMessage } = await import("./GifMessage.tsrx") as never);
  ({ Assets } = await import("@common/assets"));
  ({ MemoryFileStore } = await import("@common/storage"));
});
afterAll(() => GlobalRegistrator.unregister());

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

/** игрок с премиумом: у него значок и рамка вокруг ника в его цвете, у остальных обычный вид */
test("премиум Бафии: цветной значок в списке игроков, значок и рамка у ника в чате", async() => {
  const assets = new Assets(new MemoryFileStore(), { createUrl: () => "blob:test" });
  const bafia = Object.assign(new Events<{ change: () => void }>(), { look: () => ({}), premiumColor: (id: string) => id == "p1" ? "#3E63DD" : undefined, online: new Set(["p1", "p2"]), avatar: (id: string) => id == "p1" ? "https://bafia.example.com/a/abc12345" : undefined, enabled: true,
    shamePoints: (nick: string) => nick == "Чужой" ? 3 : undefined, banUntil: (nick: string) => nick == "Обычный" ? Date.now() + 3_600_000 : undefined });
  const root = document.body.appendChild(document.createElement("div"));
  const users = [{ username: "Звезда", playerObjectId: "p1" }, { username: "Обычный", playerObjectId: "p2" }];

  const dispose = ui.mount(() => PlayersPanel({
    users: () => users, myName: () => "я", hideName: () => false, assets, mention: () => {}, profile: () => {},
    inBafia: () => true, badgeColor: (id: string) => bafia.premiumColor(id), avatar: (id: string) => bafia.avatar(id)
  }) as never, root);
  // gif-аватарка у игрока с премиумом, у остальных обычное фото
  const photos = [...root.querySelectorAll<HTMLImageElement>("img.avatar")];
  expect(photos.map(photo => photo.getAttribute("src")?.includes("/a/abc12345"))).toEqual([true, false]);
  const badges = [...root.querySelectorAll<HTMLElement>(".bafia")];
  expect(badges).toHaveLength(2);
  expect(badges[0]!.style.background).toMatch(/#3E63DD|rgb\(62, 99, 221\)/i);
  expect(badges[1]!.style.background).toBe("");
  dispose();

  const entries = [{ id: 1, kind: "message" as const, text: "привет", user: users[0] }, { id: 2, kind: "message" as const, text: "ку", user: users[1] }, { id: 3, kind: "message" as const, text: "я не в Бафии", user: { username: "Чужой", playerObjectId: "p3" } }];
  const disposeChat = ui.mount(() => ChatView({
    entries: () => entries, myName: () => "я", hideName: () => false, assets, send: () => {}, bafia: bafia as never, readonly: true
  } as never) as never, root);
  await tick();
  expect([...root.querySelectorAll<HTMLImageElement>("img.avatar")].map(photo => photo.getAttribute("src")?.includes("/a/abc12345"))).toEqual([true, false, false]);
  // значки нарушителей: «БАН» у игрока в бане, «Позор» у набравшего очки, у остальных нет
  const marked = [...root.querySelectorAll<HTMLElement>(".nick")].map(nick => [...nick.querySelectorAll(".mark")].map(mark => mark.textContent));
  expect(marked).toEqual([[], ["БАН"], ["Позор"]]);
  const nicks = [...root.querySelectorAll<HTMLElement>(".nick")];
  expect(nicks[0]!.style.border).toMatch(/#3E63DD|rgb\(62, 99, 221\)/i);
  expect(nicks[0]!.querySelector(".pbadge")).not.toBeNull();
  // обычный игрок Бафии: значок «Б» есть, обычного цвета, без цветной рамки
  expect(nicks[1]!.style.border).toBe("");
  expect(nicks[1]!.querySelector(".pbadge")).not.toBeNull();
  expect(nicks[1]!.querySelector<HTMLElement>(".pbadge")!.style.background).toBe("var(--accent)");
  expect(nicks[2]!.querySelector(".pbadge")).toBeNull();      // игрок не из Бафии: значка нет
  expect(nicks[0]!.querySelector<HTMLElement>(".pbadge")!.style.background).toMatch(/#3E63DD|rgb\(62, 99, 221\)/i);
  disposeChat();
  root.remove();
});

test("панель гифок: «Добавить» и вкладка «Мои» есть у всех, премиум не нужен", async() => {
  const calls: string[] = [];
  const bafia = Object.assign(new Events<{ change: () => void }>(), { favorites: [] as { id: string, title: string }[], premiumUntil: undefined as number | undefined, gifs: async(_query: string, source: string) => { calls.push(source); return []; } });
  const root = document.body.appendChild(document.createElement("div"));
  const dispose = ui.mount(() => GifPicker({ bafia, pick: () => {} }) as never, root);
  await tick();
  expect(calls).toEqual(["giphy"]);
  const tab = (name: string) => [...root.querySelectorAll("button")].find(button => button.textContent == name);
  expect(tab("Мои")).toBeDefined();
  expect(tab("+ Добавить")).toBeUndefined();   // на вкладке Giphy свои файлы не нужны

  tab("Бафия")!.click();
  await tick();
  expect(calls).toEqual(["giphy", "bafia"]);
  expect(tab("+ Добавить")).toBeDefined();
  expect(root.querySelector(".status")).toBeNull();
  dispose();
  root.remove();
});

test("гифка в сообщении: пока скачивается - заглушка, потом сама гифка из кэша; нет такой гифки - пояснение", async() => {
  let finish!: (url: string) => void;
  const bafia = Object.assign(new Events<{ change: () => void }>(), {
    enabled: true, ready: true,
    gif: async(id: string) => id == "cat" ? { id, url: "https://media.giphy.com/media/cat/200w.gif", title: "Кот" } : null,
    isFavorite: () => false, toggleFavorite: () => true,
    images: { load: () => new Promise<string>(resolve => { finish = resolve; }) }
  });
  const root = document.body.appendChild(document.createElement("div"));
  const dispose = ui.mount(() => GifMessage({ bafia, id: "cat" }) as never, root);
  await tick();
  expect(root.querySelector(".wait")).not.toBeNull();
  expect(root.querySelector("img")).toBeNull();

  finish("blob:cat");
  await tick();
  expect(root.querySelector(".wait")).toBeNull();
  expect(root.querySelector("img")?.getAttribute("src")).toBe("blob:cat");
  // размер задаёт только общий стиль коробки (она одинаковая у заглушки и у гифки): свой размер у картинки сдвигал бы переписку
  expect(root.querySelector("img")?.getAttribute("style")).toBeNull();
  expect(root.querySelector(".box")?.querySelector(".gif")).not.toBeNull();
  dispose();

  const second = ui.mount(() => GifMessage({ bafia, id: "none" }) as never, root);
  await tick();
  expect(root.textContent).toContain("такой гифки нет");
  second();
  root.remove();
});

test("панель гифок: избранное открывается первым; звёздочка добавляет в избранное, а в самом избранном убирает гифку из списка", async() => {
  const calls: string[] = [];
  const stars = { favorites: [{ id: "a1", title: "Кот" }, { id: "b2", title: "Пёс" }] };
  const events = new Events<{ change: () => void }>();
  const bafia = Object.assign(events, {
    toggleFavorite(id: string, title: string) {
      const had = stars.favorites.some(item => item.id == id);
      stars.favorites = had ? stars.favorites.filter(item => item.id != id) : [{ id, title }, ...stars.favorites];
      events.emit("change");
      return !had;
    },
    gifs: async(_query: string, source: string) => {
      calls.push(source);
      return source == "favorites" ? [{ id: "a1", url: "https://x/a1.gif", title: "Кот" }, { id: "b2", url: "https://x/b2.gif", title: "Пёс" }] : [{ id: "g_x", url: "https://x/x.gif", title: "Другое" }];
    }
  });
  // Object.assign скопировал бы геттер значением, а список должен быть живым
  Object.defineProperty(bafia, "favorites", { get: () => stars.favorites });
  const root = document.body.appendChild(document.createElement("div"));
  const dispose = ui.mount(() => GifPicker({ bafia, pick: () => {} }) as never, root);
  await tick();
  expect(calls).toEqual(["favorites"]);
  const cells = () => [...root.querySelectorAll<HTMLElement>(".cell")];
  expect(cells()).toHaveLength(2);
  expect(root.querySelector<HTMLInputElement>('input[type=text]')?.placeholder).toBe("Поиск в избранном");
  expect(cells()[0]!.querySelector(".star")?.textContent).toBe("★");

  cells()[0]!.querySelector<HTMLElement>(".star")!.click();            // убрать Кота из избранного
  await tick();
  expect(stars.favorites.map(item => item.id)).toEqual(["b2"]);
  expect(cells()).toHaveLength(1);

  [...root.querySelectorAll("button")].find(button => button.textContent == "Giphy")!.click();
  await tick();
  const star = root.querySelector<HTMLElement>(".cell .star")!;
  expect(star.textContent).toBe("☆");
  star.click();
  await tick();
  expect(stars.favorites.map(item => item.id)).toEqual(["g_x", "b2"]);
  expect(root.querySelector(".cell .star")?.textContent).toBe("★");
  dispose();
  root.remove();
});

test("гифка в сообщении: звёздочка добавляет в избранное и убирает", async() => {
  const stars = new Set<string>();
  const events = new Events<{ change: () => void }>();
  const bafia = Object.assign(events, {
    enabled: true, ready: true,
    gif: async(id: string) => ({ id, url: "https://x/cat.gif", title: "Кот" }),
    images: { load: async() => "blob:cat" },
    isFavorite: (id: string) => stars.has(id),
    toggleFavorite(id: string) { stars.has(id) ? stars.delete(id) : stars.add(id); events.emit("change"); return stars.has(id); }
  });
  const root = document.body.appendChild(document.createElement("div"));
  const dispose = ui.mount(() => GifMessage({ bafia, id: "cat" }) as never, root);
  await tick();
  await tick();
  const star = () => root.querySelector<HTMLElement>(".fav")!;
  expect(star().textContent).toBe("☆");
  star().click();
  await tick();
  expect([...stars]).toEqual(["cat"]);
  expect(star().textContent).toBe("★");
  star().click();
  await tick();
  expect(stars.size).toBe(0);
  expect(star().textContent).toBe("☆");
  dispose();
  root.remove();
});

test("чат: кто был внизу, остаётся внизу, когда загрузилась картинка или поменялась высота списка; кто листал вверх, остаётся на месте", async() => {
  const assets = new Assets(new MemoryFileStore(), { createUrl: () => "blob:test" });
  const root = document.body.appendChild(document.createElement("div"));
  const entries = [{ id: 1, kind: "message" as const, text: "привет :sm1:", user: { username: "Звезда", playerObjectId: "p1" } }];
  const dispose = ui.mount(() => ChatView({ entries: () => entries, myName: () => "я", hideName: () => false, assets, send: () => {}, readonly: true } as never) as never, root);
  await tick();
  const list = root.querySelector<HTMLElement>(".messages")!;
  let height = 1000;
  Object.defineProperty(list, "scrollHeight", { get: () => height, configurable: true });
  Object.defineProperty(list, "clientHeight", { value: 300, configurable: true });
  const image = list.querySelector("img")!;

  // читатель внизу: картинка выросла, список дотянулся до низа
  list.scrollTop = 700;
  list.dispatchEvent(new Event("scroll"));
  height = 1300;
  image.dispatchEvent(new Event("load"));
  expect(list.scrollTop).toBe(1300);

  // читатель ушёл читать старое: ничего не двигаем
  list.scrollTop = 100;
  list.dispatchEvent(new Event("scroll"));
  height = 1700;
  image.dispatchEvent(new Event("load"));
  expect(list.scrollTop).toBe(100);
  dispose();
  root.remove();
});

describe("чат всегда внизу", () => {
  const entries = [{ id: 1, kind: "message" as const, text: "привет", user: { username: "Звезда", playerObjectId: "p1" } }];
  let assets: InstanceType<typeof Assets>;
  const mountChat = (controller?: { scrollToEnd?: () => void }, send: (text: string) => void = () => {}) => {
    const root = document.body.appendChild(document.createElement("div"));
    const dispose = ui.mount(() => ChatView({ entries: () => entries, myName: () => "я", hideName: () => false, assets, send, controller } as never) as never, root);
    return { root, dispose, list: () => root.querySelector<HTMLElement>(".messages")! };
  };
  /** размеры в happy-dom нулевые: задаём высоту содержимого заранее, до показа чата */
  const withHeight = (value: () => number, run: () => void | Promise<void>) => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { get: value, configurable: true });
    const restore = () => original ? Object.defineProperty(HTMLElement.prototype, "scrollHeight", original) : delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
    return Promise.resolve(run()).finally(restore);
  };
  test("чат открывается в самом низу, а не в случайном месте", async() => {
    assets = new Assets(new MemoryFileStore(), { createUrl: () => "blob:test" });
    await withHeight(() => 1000, async() => {
      const { root, dispose, list } = mountChat();
      await tick();
      expect(list().scrollTop).toBe(1000);
      dispose();
      root.remove();
    });
  });

  test("прокрутку, которую сделали мы, браузер сообщает событием scroll: это не уход читателя, чат остаётся внизу при дальнейшем росте", async() => {
    assets = new Assets(new MemoryFileStore(), { createUrl: () => "blob:test" });
    let height = 1000;
    await withHeight(() => height, async() => {
      const { root, dispose, list } = mountChat();
      await tick();
      expect(list().scrollTop).toBe(1000);
      Object.defineProperty(list(), "clientHeight", { value: 300, configurable: true });

      height = 1500;                                   // содержимое выросло, пока событие scroll ещё в пути
      list().dispatchEvent(new Event("scroll"));       // событие от нашей прокрутки: scrollTop прежний
      list().dispatchEvent(new Event("load"));         // подгрузилась картинка: дотягиваемся до нового низа
      expect(list().scrollTop).toBe(1500);
      dispose();
      root.remove();
    });
  });

  test("после своего сообщения чат уходит вниз, даже если читатель листал вверх", async() => {
    assets = new Assets(new MemoryFileStore(), { createUrl: () => "blob:test" });
    let height = 1000;
    await withHeight(() => height, async() => {
      const controller: { scrollToEnd?: () => void } = {};
      const { root, dispose, list } = mountChat(controller);
      await tick();
      Object.defineProperty(list(), "clientHeight", { value: 300, configurable: true });
      list().scrollTop = 100;                          // читатель ушёл вверх
      list().dispatchEvent(new Event("scroll"));
      height = 1400;
      list().dispatchEvent(new Event("load"));
      expect(list().scrollTop).toBe(100);              // не трогаем

      controller.scrollToEnd!();
      expect(list().scrollTop).toBe(1400);
      height = 1800;                                   // и дальше остаёмся внизу
      list().dispatchEvent(new Event("load"));
      expect(list().scrollTop).toBe(1800);
      dispose();
      root.remove();
    });
  });
});

describe("меню сообщения", () => {
  const entries = [{ id: 1, kind: "message" as const, text: "привет", user: { username: "Друг", playerObjectId: "p1" } }];
  const mountChat = (onMenu?: (entry: unknown, event: Event) => void) => {
    const assets = new Assets(new MemoryFileStore(), { createUrl: () => "blob:test" });
    const root = document.body.appendChild(document.createElement("div"));
    const dispose = ui.mount(() => ChatView({ entries: () => entries, myName: () => "я", hideName: () => false, assets, send: () => {}, readonly: true, onMenu } as never) as never, root);
    return { root, dispose, message: () => root.querySelector<HTMLElement>(".text")! };
  };

  test("правая кнопка открывает меню сообщения; без onMenu (комната, общий чат) ничего не меняется", async() => {
    const opened: string[] = [];
    const { root, dispose, message } = mountChat(entry => void opened.push((entry as { text: string }).text));
    await tick();
    expect(message().classList.contains("menuable")).toBe(true);
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    message().dispatchEvent(event);
    expect(opened).toEqual(["привет"]);
    expect(event.defaultPrevented).toBe(true);
    dispose(); root.remove();

    const plain = mountChat();
    await tick();
    expect(plain.message().classList.contains("menuable")).toBe(false);
    const plainEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    plain.message().dispatchEvent(plainEvent);
    expect(plainEvent.defaultPrevented).toBe(false);          // обычное меню браузера не трогаем
    plain.dispose(); plain.root.remove();
  });

  test("долгое нажатие пальцем открывает меню; короткое нажатие и сдвиг пальца (прокрутка) - нет", async() => {
    const opened: string[] = [];
    const { root, dispose, message } = mountChat(entry => void opened.push((entry as { text: string }).text));
    await tick();
    const touch = (type: string, x = 5, y = 5) => message().dispatchEvent(Object.assign(new Event(type, { bubbles: true }), { pointerType: "touch", clientX: x, clientY: y }));

    touch("pointerdown"); touch("pointerup");                     // короткое нажатие
    await new Promise(resolve => setTimeout(resolve, 700));
    expect(opened).toEqual([]);

    touch("pointerdown"); touch("pointermove", 5, 60);            // палец поехал листать
    await new Promise(resolve => setTimeout(resolve, 700));
    expect(opened).toEqual([]);

    touch("pointerdown");                                         // держим
    await new Promise(resolve => setTimeout(resolve, 700));
    expect(opened).toEqual(["привет"]);
    dispose(); root.remove();
  });
});

describe("анимации украшений", () => {
  test("при выключенных анимациях (экономия ресурсов) Lottie не создаётся: файл не читается и библиотека не грузится; при включённых - читается", async() => {
    const { default: Lottie } = { default: (await import("./Lottie.tsrx") as unknown as { Lottie: (props: Record<string, unknown>) => unknown }).Lottie };
    const { animationSource, setAnimationsOff } = await import("./animation-source");
    const reads: string[] = [];
    animationSource.read = async(path: string) => { reads.push(path); return "{}"; };      // готовое содержимое: в сеть за файлом не ходим
    const warn = console.warn;
    console.warn = () => {};
    const spec = { path: "animations/username_animations/dots_0.json", url: "https://x/dots_0.json", speed: 1, alpha: 1 };
    const root = document.body.appendChild(document.createElement("div"));

    setAnimationsOff(true);
    const off = ui.mount(() => Lottie({ animation: () => spec }) as never, root);
    await tick();
    expect(reads).toEqual([]);
    off();

    setAnimationsOff(false);
    const on = ui.mount(() => Lottie({ animation: () => spec }) as never, root);
    await tick();
    expect(reads).toEqual([spec.path]);
    on();
    console.warn = warn;
    root.remove();
  });
});

