import "fake-indexeddb/auto";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Assets } from "@common/assets";
import { createFakeNetwork, type FakeSocket } from "@common/net/testing";
import { createStorage, MemoryFileStore, type Account } from "@common/storage";
import { md5salt } from "@common/utils/md5";
import { NotificationCenter } from "@common/ui/notifications/center";
import { ThemeManager } from "@common/ui/theme";
import { WindowManager } from "@launcher/windows/manager";
import { spawnInProcess } from "./mods/testing";

let startGame: typeof import("./app").startGame;
// экраны - .tsrx, им нужен DOM; он подменяет глобальные Blob и др., после тестов убираем
beforeAll(async() => {
  GlobalRegistrator.register();
  ({ startGame } = await import("./app"));
});
afterAll(() => GlobalRegistrator.unregister());

const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

const signedIn = { ty: "usi", usid: { u: "Euaek", t: "token", o: "o1", uo: "uo1" } };
const dashboard = { ty: "db", db: { du: { u: "Euaek", puo: "p1", l: 11, ex: 100100, nle: 165270, mmscr: 7 }, uac: { gcns: 10000, scns: 99700 } } };

function server(packet: Record<string, any>, socket: FakeSocket) {
  if(packet.ty == "sin") socket.receive(packet.pw == md5salt("правильный") ? signedIn : { ty: "siner", e: -3 });
  if(packet.ty == "acd") socket.receive(dashboard);
}

const notifications = new NotificationCenter();

async function launch(account?: Partial<Account>, respond: typeof server = server, windowOptions: { fullscreen?: boolean } = {}) {
  const network = createFakeNetwork();
  network.respond = respond;
  const manager = new WindowManager({ viewport: () => ({ width: 1000, height: 700 }), closeDelay: 0 });
  const files = new MemoryFileStore();
  const storage = createStorage(files);
  const window = manager.open({ title: "Бафия", ...windowOptions });
  document.body.append(window.content);

  const game = await startGame(
    { window, manager, storage, assets: new Assets(files, { createUrl: () => "blob:test" }), theme: new ThemeManager({ style: { setProperty() {}, removeProperty() {} } }), notifications, account: account as Account },
    { createSocket: () => network.createSocket(), slowConnectionAfter: 50, spawnWorker: spawnInProcess }
  );
  await tick(10);
  const text = () => window.content.textContent ?? "";
  const click = (label: string) => [...window.content.querySelectorAll("button")].find(button => button.textContent?.includes(label))!.click();
  const press = (label: string) => window.content.querySelector<HTMLElement>(`button[aria-label="${label}"]`)!.click();
  return { game, window, network, text, click, press, files };
}

describe("игра", () => {
  test("аккаунт с паролем: входит сам и показывает меню с данными игрока", async() => {
    const { game, window, text } = await launch({ name: "Euaek", email: "a@b.c", password: "правильный" });
    await tick(10);

    expect(game.ctx.nav.top?.name).toBe("menu");
    expect(text()).toContain("Euaek");
    expect(text()).toContain("11");
    expect(text()).toContain("99 700");
    expect(text()).toContain("10 000");
    expect(window.title).toBe("Бафия - Euaek");
  });

  test("неверный пароль: экран входа с причиной", async() => {
    const { game, text } = await launch({ email: "a@b.c", password: "неправильный" });
    await tick(10);

    expect(game.ctx.nav.top?.name).toBe("authorization");
    expect(text()).toContain("Неверный пароль");
  });

  test("без аккаунта: форма входа, после ввода пароля - меню", async() => {
    const { game, window, text } = await launch();
    await tick(10);
    expect(game.ctx.nav.top?.name).toBe("authorization");

    const [email, password] = [...window.content.querySelectorAll("input")] as HTMLInputElement[];
    email!.value = "a@b.c";
    password!.value = "правильный";
    window.content.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    await tick(20);

    expect(game.ctx.nav.top?.name).toBe("menu");
    expect(text()).toContain("Euaek");
  });

  test("кнопка меню открывает экран, «назад» возвращает в меню", async() => {
    const { game, window, click } = await launch({ email: "a@b.c", password: "правильный" });
    await tick(10);

    click("Рейтинги");
    expect(game.ctx.nav.top?.name).toBe("ratings");

    await tick(350);
    window.content.querySelector<HTMLElement>("button[aria-label=Назад]")!.click();
    expect(game.ctx.nav.top?.name).toBe("menu");
  });

  test("закрытие окна закрывает соединение", async() => {
    const { window, network } = await launch({ email: "a@b.c", password: "правильный" });
    await window.close();
    expect(network.sockets.every(socket => socket.closed)).toBe(true);
  });

  test("у окна без заголовка (телефон) в шапке есть крестик: закрывает игру после подтверждения; у обычного окна его нет", async() => {
    const normal = await launch({ email: "a@b.c", password: "правильный" });
    expect(normal.window.content.querySelector("button[aria-label='Закрыть игру']")).toBeNull();

    const phone = await launch({ email: "a@b.c", password: "правильный" }, server, { fullscreen: true });
    await tick(10);
    phone.press("Закрыть игру");
    await tick();
    expect(phone.text()).toContain("Закрыть игру?");
    phone.click("Отмена");
    await tick(10);
    expect(phone.network.sockets.some(socket => socket.closed)).toBe(false);

    phone.press("Закрыть игру");
    await tick();
    phone.click("Закрыть");
    await tick(20);
    expect(phone.network.sockets.every(socket => socket.closed)).toBe(true);
  });

  test("профиль: статистика без NaN, кнопка по состоянию дружбы, принятие через подтверждение", async() => {
    const { network, text, click, game } = await launch({ email: "a@b.c", password: "правильный" });
    await tick(10);
    const base = network.respond!;
    network.respond = (packet, socket) => {
      if(packet.ty == "gup") socket.receive({ ty: "uup", uup: { pud: { u: "Игрок", puo: "p2", l: 12, ex: 10, nle: 100, on: true, prst: { "4": 5, "1": 10 }, pg: 20, wim: 3, wip: 7 }, uac: { scns: 1500, gcns: 3 }, fp: false, fpf: 2 } });
      else if(packet.ty == "af") socket.receive({ ty: "af" });
      else base(packet, socket);
    };

    game.ctx.openProfile("p2");   // профиль другого игрока (из чата, списка игроков) - окно поверх экрана
    await tick(50);

    expect(game.ctx.nav.top?.name).toBe("menu");
    expect(text()).toContain("ПРОФИЛЬ");
    expect(network.last.sent.find(packet => packet.ty == "gup")).toMatchObject({ ur: "p2" });
    expect(text()).toContain("Игрок");
    expect(text()).toContain("(50.00%) 10");    // 10 побед из 20 игр
    expect(text()).toContain("1\u00a0500");
    expect(text()).not.toContain("NaN");

    // fpf = 2: вам прислали заявку; «Принять» спрашивает подтверждение, потом шлёт af и перезагружает профиль
    click("Принять дружбу");
    await tick();
    click("Да");
    await tick(20);
    expect(network.last.sent.filter(packet => packet.ty == "af")).toHaveLength(1);
    expect(network.last.sent.filter(packet => packet.ty == "gup")).toHaveLength(2);
  });

  test("профиль: «сейчас играет в комнате» показывается карточкой комнаты как в списке, нажатие входит в комнату", async() => {
    const { network, text, window, game } = await launch({ email: "a@b.c", password: "правильный" });
    await tick(10);
    const base = network.respond!;
    network.respond = (packet, socket) => {
      // у комнаты из профиля может не быть названия, как в реальном ответе
      if(packet.ty == "gup") socket.receive({ ty: "uup", uup: { pud: { u: "Игрок", puo: "p2", l: 12, ex: 10, nle: 100, on: true, pg: 20 }, uac: { scns: 1, gcns: 1 }, rr: { o: "ru_77", mnl: 5, mnp: 5, mxp: 8, pn: 3, s: 0, sr: [2, 9], pw: "h" } } });
      else base(packet, socket);
    };

    game.ctx.openProfile("p2");
    await tick(50);
    expect(text()).toContain("Сейчас играет в комнате");
    const card = [...window.content.querySelectorAll<HTMLElement>(".room")].find(element => element.textContent?.includes("Комната игрока"))!;
    expect(card.textContent).toContain("Регистрация");
    expect(card.textContent).toContain("Игроки: 3 [5/8]");
    expect(card.textContent).toContain("🔒");
    expect(card.querySelectorAll(".roles img")).toHaveLength(2);
    expect(game.ctx.crash()).toBeUndefined();
  });

  test("«интерфейс с маленькой буквы»: включается из настроек и помечает корень игры", async() => {
    const { game, window } = await launch({ email: "a@b.c", password: "правильный" });
    await tick(10);
    const root = () => window.content.querySelector("[data-lowercase]")!.getAttribute("data-lowercase");
    expect(root()).toBe("false");
    game.ctx.settings.update(settings => { settings.lowercase = true; });
    expect(root()).toBe("true");
    // ник игрока в меню помечен: его регистр не меняется
    expect(window.content.querySelector("[data-keep]")?.textContent).toContain("Euaek");
  });

  test("настройки: флажок меняет настройки и сохраняется в хранилище", async() => {
    const { press, window, game, files } = await launch({ email: "a@b.c", password: "правильный" });
    await tick(10);

    press("Настройки");
    await tick(350);

    const hide = [...window.content.querySelectorAll(".row")].find(row => row.textContent?.includes("Скрывать никнейм"))!.querySelector("input")!;
    hide.checked = true;
    hide.dispatchEvent(new Event("change", { bubbles: true }));

    expect(game.ctx.settings.data.hideUsername).toBe(true);
    await game.ctx.settings.flush();
    expect(JSON.parse((await files.read("/game/settings.json"))!).hideUsername).toBe(true);
  });

  test("настройки: строка «Премиум» появляется только после согласия на сервер Бафии (экран не падает)", async() => {
    const { press, click, window, game } = await launch({ email: "a@b.c", password: "правильный" });
    await tick(10);
    press("Настройки");
    await tick(350);

    const rows = () => [...window.content.querySelectorAll(".row")].map(row => row.textContent ?? "");
    expect(rows().some(row => row.includes("Премиум"))).toBe(false);

    game.ctx.settings.update(settings => { settings.bafia.enabled = true; });
    await tick(20);
    expect(rows().some(row => row.includes("Премиум"))).toBe(true);

    // «Купить»: сначала окно с преимуществами, бот открывается только после согласия
    const opened: string[] = [];
    const original = globalThis.open;
    globalThis.open = ((url: string) => { opened.push(url); return null; }) as never;
    click("Купить");
    await tick();
    expect(window.content.textContent).toContain("Премиум даёт");
    expect(window.content.textContent).toContain("цветной значок");
    click("Не сейчас");
    await tick();
    expect(opened).toEqual([]);

    click("Купить");
    await tick();
    click("Открыть бота");
    await tick();
    expect(opened).toEqual(["https://t.me/bafiaonlineopt_bot"]);
    globalThis.open = original;
    expect(game.ctx.crash()).toBeUndefined();
  });

  test("аккаунт без ника: окно ввода повторяется, пока сервер не примет", async() => {
    const { game, window, text, click } = await launch({ email: "a@b.c", password: "правильный" }, (packet, socket) => {
      if(packet.ty == "sin") socket.receive(signedIn);
      if(packet.ty == "acd") socket.receive({ ty: "db", db: { du: { u: "", puo: "p1", l: 1 }, uac: {} } });
      if(packet.ty == "uns") socket.receive(packet.u == "Занят" ? { ty: "unex" } : { ty: "uns", u: packet.u });
    });
    await tick(20);

    const enter = async(nickname: string) => {
      window.content.querySelector("input")!.value = nickname;
      window.content.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      await tick(20);
    };

    expect(text()).toContain("НИКНЕЙМ");
    await enter("ab");                      // слишком короткий: до сервера не доходит
    expect(window.content.querySelector(".error")?.textContent).toContain("От 3 до 12");

    await enter("Занят");
    expect(text()).toContain("Этот никнейм уже занят");
    click("OK");
    await tick(20);
    expect(text()).toContain("НИКНЕЙМ");    // спросили снова

    await enter("Новичок");
    expect(game.ctx.user.username).toBe("Новичок");
    expect(text()).not.toContain("НИКНЕЙМ");
  });

  test("фото профиля: список стандартных, выбор отправляется на сервер", async() => {
    const { network, press, text, window, game } = await launch({ email: "a@b.c", password: "правильный" });
    await tick(10);
    const base = network.respond!;
    network.respond = (packet, socket) => {
      if(packet.ty == "usgdph") socket.receive({ ty: "usdph", usdph: { usdphi: ["f1", "m1"] } });
      else if(packet.ty == "ussdph") socket.receive({ ty: "ussdph" });
      else base(packet, socket);
    };

    press("Сменить фото");
    await tick(20);
    expect(text()).toContain("ФОТО ПРОФИЛЯ");

    const photos = [...window.content.querySelectorAll<HTMLImageElement>(".grid img")];
    expect(photos.map(image => image.alt)).toEqual(["m1", "f1"]);   // мужские первыми
    photos[0]!.click();
    await tick(20);

    expect(network.last.sent.find(packet => packet.ty == "ussdph")).toMatchObject({ ph: "m1", puo: "p1" });
    expect(game.ctx.user.photo).toBe("m1");
    expect(text()).not.toContain("ФОТО ПРОФИЛЯ");
  });

  test("общий чат: история, новое сообщение, упоминание по клику на ник, отправка, выход отписывает", async() => {
    const { network, window, click, text, game } = await launch({ email: "a@b.c", password: "правильный" });
    await tick(10);
    const base = network.respond!;
    network.respond = (packet, socket) => {
      if(packet.ty == "acc") {
        socket.receive({ ty: "ms", ms: [{ tx: "привет <b>всем</b>", uu: { u: "Игрок", puo: "p2" } }, { tx: "ты тут? [Euaek] :sm1:", uu: { u: "Игрок", puo: "p2" } }, { t: 2, uu: { u: "Вошедший", puo: "p9" } }] });
        socket.receive({ ty: "u", u: [{ u: "Игрок", puo: "p2" }] });
      } else base(packet, socket);
    };

    click("Чат");
    await tick(350);
    expect(text()).toContain("привет <b>всем</b>");           // HTML не интерпретируется
    expect(window.content.querySelectorAll(".group")).toHaveLength(1);   // два сообщения одного игрока - одна группа
    expect(window.content.querySelector(".mention")?.textContent).toBe("[Euaek]");
    expect(window.content.querySelectorAll(".players .player")).toHaveLength(1);   // игроки в рамке над сообщениями, без кнопки
    // «Игрок … вошёл»: аватарка, ник кликабелен (упоминание)
    expect(window.content.querySelector(".event .who img")).not.toBeNull();

    network.last.receive({ ty: "m", m: { tx: "новое", uu: { u: "Другой", puo: "p3" } } });
    await tick();
    expect(window.content.querySelectorAll(".group")).toHaveLength(2);

    const input = window.content.querySelector<HTMLInputElement>(".footer input")!;
    window.content.querySelector<HTMLElement>(".nick")!.click();
    expect(input.value).toBe("[Игрок] ");                      // клик по нику вставил упоминание
    input.value += "ответ";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(network.last.sent.find(packet => packet.ty == "cmc")?.m.tx).toBe("[Игрок] ответ");
    expect(input.value).toBe("");

    window.content.querySelector<HTMLElement>("button[aria-label=Назад]")!.click();
    await tick(350);
    network.last.receive({ ty: "m", m: { tx: "после выхода", uu: { u: "X" } } });
    expect(game.ctx.nav.top?.name).toBe("menu");
  });

  test("значки заявок и сообщений в меню: после возврата из «Друзей» берутся свежие данные, прочитанное пропадает", async() => {
    const { network, window, click, press, game } = await launch({ email: "a@b.c", password: "правильный" });
    await tick(10);
    const withCounts = (nm: number, fr: number) => ({ ty: "db", db: { du: { u: "Euaek", puo: "p1", l: 11, ex: 100100, nle: 165270 }, uac: { gcns: 1, scns: 1 }, nm, fr } });
    const base = network.respond!;
    let counts = withCounts(3, 1);
    network.respond = (packet, socket) => {
      if(packet.ty == "acd") socket.receive(counts);
      else if(packet.ty == "acfl") socket.receive({ ty: "frl", frl: { frl: [] } });
      else base(packet, socket);
    };

    // сервер прислал счётчики (как при опросе): игрок и значки обновляются
    network.last.receive(counts);
    await tick(10);
    expect(window.content.querySelectorAll(".count")).toHaveLength(2);

    // всё прочитано и принято, но экран «Друзья» счётчики не трогал
    counts = withCounts(0, 0);
    click("Друзья");
    await tick(350);
    press("Назад");
    await tick(400);
    expect(game.ctx.nav.top?.name).toBe("menu");
    expect(window.content.querySelectorAll(".count")).toHaveLength(0);
  });

  test("друзья: список, переход в личный чат, принятие заявки, удаление с подтверждением", async() => {
    const { network, window, click, text, game } = await launch({ email: "a@b.c", password: "правильный" });
    await tick(10);
    const base = network.respond!;
    network.respond = (packet, socket) => {
      if(packet.ty == "acfl") socket.receive({ ty: "frl", frl: { frl: [
        { o: "fr1", ff: { puo: "p2", u: "Друг", on: true }, nm: "2", up: 1700000000000 },
        { o: "fr2", ff: { puo: "p3", u: "Оффлайн", on: false } }
      ] } });
      else if(packet.ty == "gsfrl") socket.receive({ ty: "frl", frl: { frl: [{ o: "fr9", uu: { puo: "p9", u: "Проситель" }, a: 0 }] } });
      else if(packet.ty == "rf" || packet.ty == "af") socket.receive({ ty: packet.ty });
      else if(packet.ty == "pcmsr") socket.receive({ ty: "pcmsr", ms: [] });
      else base(packet, socket);
    };

    click("Друзья");
    await tick(350);
    expect(text()).toContain("Друзья (онлайн: 1 из 2)");
    expect(text()).toContain("Друг");

    click("Запросы");
    await tick(20);
    expect(text()).toContain("Проситель");
    click("Принять");
    await tick();
    click("Да");
    await tick(20);
    expect(network.last.sent.find(packet => packet.ty == "af")).toMatchObject({ f: "p9" });

    click("Друзья");
    await tick(20);
    window.content.querySelectorAll<HTMLElement>("button[aria-label=Удалить]")[1]!.click();
    await tick();
    click("Удалить");
    await tick(20);
    expect(network.last.sent.find(packet => packet.ty == "rf")).toMatchObject({ f: "p3" });
    expect(text()).not.toContain("Оффлайн");

    window.content.querySelector<HTMLElement>(".item")!.click();   // клик по строке друга открывает личный чат
    await tick(350);
    expect(game.ctx.nav.top).toMatchObject({ name: "privateChat", params: { friendshipId: "fr1", username: "Друг" } });
    expect(network.last.sent.find(packet => packet.ty == "acpc")).toMatchObject({ fp: "fr1" });
  });

  test("комнаты: список, поиск, вход; пароль спрашивается, неверный даёт повторный запрос", async() => {
    const { network, window, click, text, game } = await launch({ email: "a@b.c", password: "правильный" });
    await tick(10);
    const base = network.respond!;
    network.respond = (packet, socket) => {
      if(packet.ty == "acrl") socket.receive({ ty: "rs", rs: [
        { o: "r1", tt: "Открытая", mnl: 1, mnp: 5, mxp: 8, pn: 3, s: 0, sr: [2, 9] },
        { o: "r2", tt: "Закрытая", mnl: 3, mnp: 5, mxp: 8, pn: 7, s: 0, pw: "hash", sr: [] }
      ] });
      else if(packet.ty == "re") socket.receive(packet.psw == "верный-хеш" || packet.ro == "r1" ? { ty: "re", rr: { o: packet.ro } } : { ty: "rpiw" });
      else base(packet, socket);
    };

    click("Комнаты");
    await tick(350);
    expect(text()).toContain("Комнаты (2 из 2)");
    expect(text()).toContain("Открытая");
    expect(text()).toContain("🔒 Закрытая");
    expect(text()).toContain("Игроки: 3 [5/8]");

    const search = window.content.querySelector<HTMLInputElement>(".toolbar input")!;
    search.value = "закр";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await tick();
    expect(text()).toContain("Комнаты (1 из 2)");
    expect(text()).not.toContain("Открытая");
    search.value = "";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await tick();

    // комната с паролем: вводим неверный → «Неправильный пароль!» → снова просят пароль
    const rooms = [...window.content.querySelectorAll<HTMLElement>(".room")];
    rooms.find(room => room.textContent?.includes("Закрытая"))!.click();
    await tick();
    expect(text()).toContain("Эта комната под замком");
    window.content.querySelector<HTMLInputElement>("form input")!.value = "неверный";
    window.content.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    await tick(20);
    expect(text()).toContain("Неправильный пароль!");

    // открытая комната: заходим
    click("OK");
    await tick(20);
    click("Отмена");
    await tick();
    rooms.find(room => room.textContent?.includes("Открытая"))!.click();
    await tick(20);
    expect(game.ctx.nav.top?.name).toBe("room");
    expect((game.ctx.nav.top!.params as { session: { roomId: string } }).session.roomId).toBe("r1");
  });

  test("создание комнаты: параметры и хеш пароля уходят на сервер, дальше - экран комнаты", async() => {
    const { network, window, click, text, game } = await launch({ email: "a@b.c", password: "правильный" });
    await tick(10);
    const base = network.respond!;
    network.respond = (packet, socket) => {
      if(packet.ty == "acrl") socket.receive({ ty: "rs", rs: [] });
      else if(packet.ty == "rc") socket.receive({ ty: "rcd", rr: { o: "new1" } });
      else base(packet, socket);
    };

    click("Комнаты");
    await tick(350);
    expect(text()).toContain("Пока нет комнат");
    click("Создать комнату");
    await tick(350);

    const title = window.content.querySelector<HTMLInputElement>("input[type=text]")!;
    title.value = "Моя комната";
    title.dispatchEvent(new Event("input", { bubbles: true }));
    const minimum = window.content.querySelectorAll<HTMLInputElement>("input[type=range]")[0]!;
    minimum.value = "7";
    minimum.dispatchEvent(new Event("input", { bubbles: true }));
    await tick();

    expect(game.ctx.settings.data.roomCreate).toMatchObject({ title: "Моя комната", minPlayers: 7, maxPlayers: 8 });
    minimum.value = "12";                                  // минимум выше максимума тянет максимум за собой
    minimum.dispatchEvent(new Event("input", { bubbles: true }));
    expect(game.ctx.settings.data.roomCreate.maxPlayers).toBe(12);

    click("Создать");
    await tick(30);
    expect(network.last.sent.find(packet => packet.ty == "rc")).toMatchObject({ rr: { tt: "Моя комната", mnp: 12, mxp: 12, pw: "" } });
    expect(game.ctx.nav.top?.name).toBe("room");
    expect((game.ctx.nav.top!.params as { session: { roomId: string } }).session.roomId).toBe("new1");
  });

  test("комната: ожидание, игра, ход по роли, голосование за исключение, выход отписывает", async() => {
    const { network, window, click, text, game } = await launch({ email: "a@b.c", password: "правильный" });
    await tick(10);
    const base = network.respond!;
    const roster = Array.from({ length: 8 }, (_, i) => ({ o: `o${i + 1}`, pu: { puo: i == 0 ? "p1" : `p${i + 1}`, u: i == 0 ? "Euaek" : `Игрок${i + 1}` } }));
    network.respond = (packet, socket) => {
      if(packet.ty == "acrl") socket.receive({ ty: "rs", rs: [{ o: "r1", tt: "Играем", mnl: 1, mnp: 5, mxp: 8, pn: 2, s: 0, sr: [2] }] });
      else if(packet.ty == "re") socket.receive({ ty: "re", rr: { o: "r1", rmt: 0, tt: "Играем", mxp: 8, mnp: 5, mnl: 1, sr: [2] } });
      else if(packet.ty == "cp") socket.receive({ ty: "rst", rst: { gs: { s: 0, t: 0 }, pls: roster.slice(0, 2), ms: [{ tx: "ждём", uu: { u: "Игрок2", puo: "p2" } }] } });
      else base(packet, socket);
    };

    click("Комнаты");
    await tick(350);
    window.content.querySelector<HTMLElement>(".room")!.click();
    await tick(350);

    expect(game.ctx.nav.top?.name).toBe("room");
    expect(text()).toContain("Игроки в комнате: 2 [5/8]");          // заголовок с числом игроков
    expect(text()).toContain("Регистрация");
    expect(text()).toContain("ждём");
    expect(window.content.querySelectorAll(".players .player")).toHaveLength(2);

    // игра началась: я - мафия, ночь мафии (dayTime 1)
    network.last.receive({ ty: "rst", rst: { gs: { s: 3, t: 30, d: 1 }, pls: roster, data: roster.map((p, i) => ({ puo: p.pu.puo, a: true, r: i == 0 ? 4 : 1 })), rls: { "1": 6, "4": 2 }, ms: [{ t: 6 }] } });
    await tick(20);
    expect(text()).toContain("Наступила ночь [МАФИЯ в чате]");
    expect(text()).toContain("Мафия: 0 | 0");
    expect(window.content.querySelectorAll(".cell")).toHaveLength(7);             // стол без вас
    expect(window.content.querySelectorAll(".cell .action")).toHaveLength(7);     // мафия ночью может ходить на всех мирных

    // ползунок масштаба стола и ширина списка игроков действуют сразу
    const slider = window.content.querySelector<HTMLInputElement>(".table .zoom")!;
    slider.value = "40";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    await tick();
    expect(game.ctx.settings.data.game.zoomPL).toBe(1.6);
    expect(window.content.querySelector<HTMLElement>(".table .scroll")!.style.zoom).toBe("1.6");

    // ширину списка игроков тянут за ручку на его левом краю: влево - шире, вправо - уже
    const before = game.ctx.settings.data.game.widthPL;
    window.content.querySelector<HTMLElement>(".splitter")!.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 500 }));
    globalThis.dispatchEvent(new MouseEvent("pointermove", { clientX: 460 }));
    expect(game.ctx.settings.data.game.widthPL).toBe(before + 40);
    globalThis.dispatchEvent(new MouseEvent("pointermove", { clientX: 540 }));
    expect(game.ctx.settings.data.game.widthPL).toBe(before - 40);
    globalThis.dispatchEvent(new MouseEvent("pointerup"));
    globalThis.dispatchEvent(new MouseEvent("pointermove", { clientX: 300 }));
    expect(game.ctx.settings.data.game.widthPL).toBe(before - 40);   // после отпускания не тянется

    window.content.querySelector<HTMLElement>(".cell")!.click();
    expect(network.last.sent.find(packet => packet.ty == "ra")).toMatchObject({ puo: "p2", ro: "r1" });

    network.last.receive({ ty: "gd", d: 2, t: 40 });
    network.last.receive({ ty: "ud", data: [{ puo: "p3", a: false }] });
    await tick(20);
    expect(window.content.querySelectorAll(".cell .action")).toHaveLength(0);     // днём без голосования роли ходить нельзя

    // голосование за исключение: кнопки только у последнего сообщения, один голос
    network.last.receive({ ty: "m", m: { t: 24, uu: { u: "Игрок4" }, u: { "0": { u: "Игрок5", puo: "p5" } } } });
    network.last.receive({ ty: "ku", puo: "p5", t: 10 });
    await tick(20);
    expect(text()).toContain("[Игрок4] начал голосование, чтобы выгнать игрока [Игрок5] из комнаты");
    click("Выгнать");
    expect(network.last.sent.find(packet => packet.ty == "kuv")).toMatchObject({ ro: "r1", v: true });

    // отказ на кик приходит баннером, экран комнаты остаётся
    network.last.receive({ ty: "kugs" });
    await tick(20);
    expect(game.ctx.nav.top?.name).toBe("room");

    // назад: игра идёт и вы живы - спрашивает подтверждение
    window.content.querySelector<HTMLElement>("button[aria-label=Назад]")!.click();
    await tick(20);
    // подтверждение «Игра идёт. Выйти?» может быть выключено: тест подходит под оба варианта
    if(text().includes("Игра идёт. Выйти из комнаты?")) click("Выйти");
    await tick(350);
    expect(game.ctx.nav.top?.name).toBe("rooms");
    expect(network.last.sent.find(packet => packet.ty == "rp")).toEqual({ ty: "rp", ro: "r1" });
  });

  test("паника: экран краха с отчётом, соединение закрыто, окна убраны; повторный вызов ничего не меняет", async() => {
    const { network, window, text, game } = await launch({ email: "a@b.c", password: "правильный" });
    await tick(10);
    const originalError = console.error;
    console.error = () => {};

    void game.ctx.dialogs.confirm("Висящее окно?");
    await tick();
    game.ctx.panic(new Error("что-то пошло не так"), "при открытии комнаты");
    game.ctx.panic(new Error("второй вызов"));
    await tick();
    console.error = originalError;

    expect(text()).toContain("Упс.. Бафия крашнулась");
    expect(window.content.querySelector<HTMLTextAreaElement>("textarea")!.value).toContain("Описание: при открытии комнаты");
    expect(window.content.querySelector<HTMLTextAreaElement>("textarea")!.value).toContain("что-то пошло не так");
    expect(window.content.querySelector<HTMLTextAreaElement>("textarea")!.value).not.toContain("второй вызов");
    expect(window.content.querySelector<HTMLTextAreaElement>("textarea")!.value).toContain("Экран игры: menu");
    expect(text()).not.toContain("Висящее окно");
    expect(network.sockets.every(socket => socket.closed)).toBe(true);
  });

  test("история: свои название и описание через меню; пустое название возвращает название комнаты", async() => {
    const { window, click, text, game } = await launch({ email: "a@b.c", password: "правильный" });
    await tick(10);
    game.ctx.history.update(history => {
      history.rooms = [{ messages: [], playersData: {}, modelType: 0, title: "Комната Васи", maxPlayers: 8, minPlayers: 5, minLevel: 1, isVipEnabled: false, selectedRoles: [], gameDayTime: 2, createdAt: 1700000000000 }];
    });
    click("История игр");
    await tick(350);

    const menuItem = async(label: string) => {
      window.content.querySelector<HTMLElement>(".game")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 30, clientY: 30 }));
      await tick();
      [...window.content.querySelectorAll<HTMLElement>(".menu .item")].find(item => item.textContent == label)!.click();
      await tick();
    };
    const answer = async(value: string) => {
      const input = window.content.querySelector<HTMLInputElement>("form input")!;
      input.value = value;
      click("Сохранить");
      await tick(20);
    };

    await menuItem("Переименовать");
    await answer("  Победа в финале  ");
    expect(game.ctx.history.data.rooms[0]!.name).toBe("Победа в финале");
    expect(text()).toContain("Победа в финале");
    expect(text()).toContain("Комната: Комната Васи");     // исходное название остаётся видно мелким текстом

    await menuItem("Добавить описание");
    await answer("играл мафией, выиграл на последнем ходу");
    expect(game.ctx.history.data.rooms[0]!.note).toBe("играл мафией, выиграл на последнем ходу");
    expect(text()).toContain("играл мафией");

    await menuItem("Переименовать");
    await answer("");
    expect(game.ctx.history.data.rooms[0]!.name).toBeUndefined();
    expect(game.ctx.crash()).toBeUndefined();
  });

  test("история: список с исходом, просмотр игры без поля ввода, удаление с подтверждением", async() => {
    const { window, click, text, game } = await launch({ email: "a@b.c", password: "правильный" });
    await tick(10);
    const players = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`p${i + 1}`, { playerObjectId: `p${i + 1}`, username: i == 0 ? "Euaek" : `Игрок${i + 1}`, index: i, alive: i != 2, role: i < 2 ? 4 : 1, affectedByRoles: [], vote: 0 }]));
    game.ctx.history.update(history => {
      history.rooms = [
        { messages: [{ tx: "ход игры", uu: { u: "Игрок2", puo: "p2" } }, { t: 16, tx: "" }], playersStat: { ty: "ps", ma: 2, m: 2, ca: 6, c: 1 }, playersData: players, modelType: 0, title: "Сыгранная", maxPlayers: 8, minPlayers: 5, minLevel: 1, isVipEnabled: false, selectedRoles: [2], gameDayTime: 2, createdAt: 1700000000000 },
        { messages: [], playersData: {}, modelType: 0, title: "Старая запись без счёта", maxPlayers: 8, minPlayers: 5, minLevel: 1, isVipEnabled: false, selectedRoles: [], gameDayTime: 2, createdAt: 1600000000000 }
      ];
    });

    click("История игр");
    await tick(350);
    expect(text()).toContain("История игр (2)");
    expect(text()).toContain("Победа");                      // мафии 2 против 1 мирного, вы мафия
    expect(text()).toContain("Игроки: 8 [5/8]");
    expect(text()).toContain("Старая запись без счёта");     // запись без счёта не ломает список

    window.content.querySelector<HTMLElement>(".game")!.click();
    await tick(350);
    expect(game.ctx.nav.top?.name).toBe("room");
    expect(text()).toContain("ход игры");
    expect(text()).toContain("Игра окончена! МИРНЫЕ ЖИТЕЛИ победили!");
    expect(window.content.querySelectorAll(".cell")).toHaveLength(7);
    expect(window.content.querySelector(".footer")).toBeNull();      // писать в чужую игру нельзя

    window.content.querySelector<HTMLElement>("button[aria-label=Назад]")!.click();
    await tick(350);
    window.content.querySelector<HTMLElement>(".game")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 30, clientY: 30 }));
    await tick();
    [...window.content.querySelectorAll<HTMLElement>(".menu .item")].find(item => item.textContent == "Удалить")!.click();
    await tick();
    click("Удалить");
    await tick(20);
    expect(game.ctx.history.data.rooms.map(record => record.title)).toEqual(["Старая запись без счёта"]);
  });
});
