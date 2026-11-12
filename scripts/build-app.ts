import { cp, rm } from "node:fs/promises";

/** папка для оболочки приложения (Capacitor): страница игры из dist/ как index.html, без сервис-воркера и README */
const APP = "dist-app";

const build = Bun.spawnSync(["bun", "scripts/build.ts"], { stdout: "inherit", stderr: "inherit" });
if(build.exitCode !== 0) process.exit(build.exitCode ?? 1);

await rm(APP, { recursive: true, force: true });
await cp("dist/play", `${APP}/play`, { recursive: true });
const page = (await Bun.file("dist/play.html").text())
  // скрипты запускает загрузчик ota.js: он берёт самую свежую сборку с сайта, а без сети - вшитую
  .replace(/<script src="\.\/play\/bin\/index\.js[^"]*"><\/script>/, '<script src="./ota.js"></script>')
  // сервис-воркер в приложении не нужен: все файлы уже внутри
  .replace(/<script>\s*\/\/ Сервис-воркер[\s\S]*?<\/script>/, "")
  .replace(/<link rel="manifest"[^>]*>\n?/, "")
  // без viewport-fit=cover оболочка сама отступает от строки состояния и панели навигации
  .replace(", viewport-fit=cover", "");
await Bun.write(`${APP}/index.html`, page);
const ota = await Bun.build({ entrypoints: ["launcher/ota-main.ts"], outdir: APP, naming: "ota.js", target: "browser", format: "iife", minify: true });
if(!ota.success) { for(const log of ota.logs) console.error(log); process.exit(1); }
if(!page.includes("./ota.js")) { console.error("В странице нет места для загрузчика ota.js"); process.exit(1); }
console.log(`Готово: ${APP}/ (для Capacitor)`);
