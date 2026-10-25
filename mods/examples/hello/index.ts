// пример мода. Код выполняется в Web Worker: `mod` - единственный способ говорить с игрой
// каждый вызов проверяется по разрешениям из manifest.json
import { mod, type PanelBlock } from "bafia:api";

let seen = 0;
let night = false;

async function render() {
  const total = (await mod.storage.get("total") as number | undefined) ?? 0;
  const blocks: PanelBlock[] = [
    { type: "text", text: `Сообщений в общем чате за сессию: ${seen}` },
    { type: "text", text: `Всего за всё время: ${total}` },
    { type: "button", id: "theme", text: night ? "Обычная тема" : "Ночная подсветка" },
    // уведомления как в macOS: каждый вид со своим значком и цветом
    { type: "text", text: "Показать уведомление:" },
    { type: "button", id: "notify:info", text: "Информация" },
    { type: "button", id: "notify:success", text: "Успех" },
    { type: "button", id: "notify:warning", text: "Предупреждение" },
    { type: "button", id: "notify:error", text: "Ошибка" }
  ];
  mod.ui.panel({ title: "Привет-мод", blocks });
}

mod.on("chat:message", async () => {
  seen++;
  await mod.storage.set("total", ((await mod.storage.get("total") as number | undefined) ?? 0) + 1);
  void render();
});

mod.commands.register("hi", async args => {
  const name = args.join(" ") || "мир";
  await mod.chat.send(`Привет, ${name}!`);
});

const notices = {
  info: { title: "Информация", text: "Так выглядит обычное уведомление." },
  success: { title: "Готово", text: "Всё получилось." },
  warning: { title: "Внимание", text: "Что-то пошло не так, но игра продолжается." },
  error: { title: "Ошибка", text: "Не удалось выполнить действие." }
} as const;

mod.ui.onAction(async id => {
  // кнопки «Показать уведомление»: mod.notify(текст, { title, kind }), нужно разрешение notify
  if(id.startsWith("notify:")) {
    const kind = id.slice("notify:".length) as keyof typeof notices;
    if(notices[kind]) await mod.notify(notices[kind].text, { title: notices[kind].title, kind });
    return;
  }
  if(id != "theme") return;
  night = !night;
  if(night) await mod.theme.set({ accent: "#7c5cff", "header-bg": "#1a1d2e" });
  else await mod.theme.clear();
  await mod.notify(night ? "Ночная подсветка включена" : "Тема возвращена");
  void render();
});

void render();
