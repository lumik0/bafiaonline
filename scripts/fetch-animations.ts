import { DECORATION_BASE } from "../common/constants";

/**
 * скачивает Lottie-анимации украшений в game/assets/animations (сервер не отдаёт CORS),
 * запуск: bun scripts/fetch-animations.ts имя_файла.json ...
 * имена видны в магазине (варианты украшений) и в профилях. Нет такого файла в папке - пропускается
 */
const folders = ["username_animations", "profile_animations"];
const names = Bun.argv.slice(2).map(name => name.endsWith(".json") ? name : name + ".json");
if(!names.length) {
  console.error("Укажи имена файлов: bun scripts/fetch-animations.ts stars_pop_style_0");
  process.exit(1);
}

for(const name of names) {
  if(/[\\/]|\.\./.test(name)) { console.error("Плохое имя:", name); continue; }
  for(const folder of folders) {
    const response = await fetch(`${DECORATION_BASE}/${folder}/${encodeURIComponent(name)}`);
    if(!response.ok) continue;
    const text = await response.text();
    try { JSON.parse(text); } catch { console.error("Не JSON:", folder, name); continue; }
    await Bun.write(`game/assets/animations/${folder}/${name}`, text);
    console.log("Скачано:", folder, name);
  }
}
