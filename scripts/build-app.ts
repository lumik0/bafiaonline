import { cp, rm } from "node:fs/promises";

/** папка для оболочки приложения (Capacitor): страница игры из dist/ как index.html, без сервис-воркера и README */
const APP = "dist-app";

const build = Bun.spawnSync(["bun", "scripts/build.ts"], { stdout: "inherit", stderr: "inherit" });
if(build.exitCode !== 0) process.exit(build.exitCode ?? 1);

await rm(APP, { recursive: true, force: true });
await cp("dist/play", `${APP}/play`, { recursive: true });
const page = (await Bun.file("dist/play.html").text())
  // сервис-воркер в приложении не нужен: все файлы уже внутри
  .replace(/<script>\s*\/\/ Сервис-воркер[\s\S]*?<\/script>/, "")
  .replace(/<link rel="manifest"[^>]*>\n?/, "");
await Bun.write(`${APP}/index.html`, page);
console.log(`Готово: ${APP}/ (для Capacitor)`);
