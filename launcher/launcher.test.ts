import "fake-indexeddb/auto";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Assets } from "@common/assets";
import { createStorage, MemoryFileStore } from "@common/storage";
import { NotificationCenter } from "@common/ui/notifications/center";
import { ThemeManager } from "@common/ui/theme";
import type { GameHost } from "./game";
import { WindowManager } from "./windows/manager";

// диалоги рисуются в окнах, поэтому нужен DOM; он подменяет глобальные Blob и др., после тестов убираем
let LauncherModel: typeof import("./model").LauncherModel;
beforeAll(async() => {
  GlobalRegistrator.register();
  // .tsrx-модули подключают стили при загрузке, им нужен document
  ({ LauncherModel } = await import("./model"));
});
afterAll(() => GlobalRegistrator.unregister());

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

async function setup(launchGame: (host: GameHost) => void | Promise<void> = () => {}) {
  const files = new MemoryFileStore();
  const storage = createStorage(files);
  await storage.accounts.upsert({ name: "Euaek", email: "a@b.c", password: "pw", userId: "u1", token: "t1" });
  await storage.accounts.upsert({ name: "Other", email: "o@b.c", password: "pw", userId: "u2", token: "t2" });

  const manager = new WindowManager({ viewport: () => ({ width: 1000, height: 700 }), closeDelay: 0 });
  const theme = new ThemeManager({ style: { setProperty() {}, removeProperty() {} } });
  const assets = new Assets(files, { createUrl: () => "blob:test" });
  const model = new LauncherModel({ storage, manager, theme, assets, notifications: new NotificationCenter(), launchGame });
  model.window = manager.open({ title: "Лаунчер" });
  return { files, storage, manager, model };
}

/** нажимает кнопку в открытом диалоге: диалог - это popup-окно с кнопками внутри */
async function pressDialogButton(manager: WindowManager, label: string) {
  await tick();
  const dialog = manager.windows.find(window => window.options.popup)!;
  // в приложении содержимое окна лежит в документе; Solid ловит клики на document
  document.body.append(dialog.content);
  const button = [...dialog.content.querySelectorAll("button")].find(element => element.textContent == label)!;
  button.click();
  await tick();
}

describe("LauncherModel", () => {
  test("при загрузке выбирает сохранённый аккаунт и не теряет неизвестные поля options.json", async() => {
    const { files, model } = await setup();
    await files.write("/options.json", JSON.stringify({ images: ["assets"], profile: "u2", theme: "macos" }));

    await model.load();

    expect(model.selected?.name).toBe("Other");
    expect(model.accounts).toHaveLength(2);

    await model.setOption("devMode", true);
    expect(JSON.parse((await files.read("/options.json"))!)).toMatchObject({ images: ["assets"], theme: "macos", profile: "u2", devMode: true });
  });

  test("play открывает окно игры с аккаунтом, запоминает выбор и снимает блокировку лаунчера", async() => {
    let host: GameHost | undefined;
    const { files, manager, model } = await setup(value => { host = value; });
    await model.load();

    await model.play(model.accounts[0]);

    expect(host?.account?.email).toBe("a@b.c");
    expect(host?.window.title).toBe("Бафия 2.0.2");
    expect(manager.windows).toContain(host!.window);
    expect(model.window?.locked).toBe(false);
    expect(JSON.parse((await files.read("/options.json"))!).profile).toBe("u1");
  });

  test("если игра не запустилась, показывается ошибка и лаунчер разблокируется", async() => {
    const { manager, model } = await setup(() => { throw new Error("нет сети"); });
    await model.load();

    const playing = model.play();
    await pressDialogButton(manager, "OK");
    await playing;

    expect(model.window?.locked).toBe(false);
  });

  test("удаление спрашивает подтверждение: «Отмена» оставляет аккаунт, «Удалить» убирает", async() => {
    const { storage, manager, model } = await setup();
    await model.load();
    const target = model.accounts[0]!;

    const cancelled = model.remove(target);
    await pressDialogButton(manager, "Отмена");
    await cancelled;
    expect(await storage.accounts.list()).toHaveLength(2);

    const confirmed = model.remove(target);
    await pressDialogButton(manager, "Удалить");
    await confirmed;
    expect((await storage.accounts.list()).map(account => account.name)).toEqual(["Other"]);
    expect(model.accounts).toHaveLength(1);
  });
});
