import { marked } from "marked";
import { cp, mkdir, rm } from "node:fs/promises";
import { buildAssets } from "./assets";
import mod from "./mod-plugin";
import tsrx from "./tsrx-plugin";

/**
 * собирает сайт целиком в dist/ - ровно то, что публикуется на GitHub Pages:
 *   play.html, play-sw.js, play.webmanifest  - новая версия (бета)
 *   play/bin/*.js                            - лаунчер, игра, ассеты (работает и с file://)
 *   play/{icon.png,splash_screens,screenshots}
 *   run/                                     - старая версия, копия из репозитория как есть
 *   index.html                               - README.md
 */
const SITE = "dist";
const PLAY = `${SITE}/play`;

await rm(SITE, { recursive: true, force: true });
await mkdir(`${PLAY}/bin`, { recursive: true });

// старая версия остаётся нетронутой
const skipJunk = (path: string) => !path.endsWith(".DS_Store");
await cp("run", `${SITE}/run`, { recursive: true, filter: skipJunk });
for(const name of ["icon.png", "splash_screens", "screenshots"]) await cp(`run/${name}`, `${PLAY}/${name}`, { recursive: true, filter: skipJunk });
await cp("public/play-sw.js", `${SITE}/play-sw.js`);
await cp("public/play.webmanifest", `${SITE}/play.webmanifest`);

const assets = await buildAssets();
await Bun.write(`${PLAY}/bin/assets.meta.js`, assets.metaJs);
await Bun.write(`${PLAY}/bin/assets.js`, assets.dataJs);

// лаунчер и игра - два скрипта: игра подключается только когда игрок нажал «Играть»
for(const [entry, name] of [["launcher/main.ts", "index.js"], ["game/entry.ts", "game.js"]] as const) {
  const result = await Bun.build({ entrypoints: [entry], outdir: `${PLAY}/bin`, naming: name, target: "browser", format: "iife", minify: true, plugins: [tsrx, mod] });
  if(!result.success) {
    for(const log of result.logs) console.error(log);
    process.exit(1);
  }
}

// заставки для iOS берём из страницы старой версии, меняя только путь
const oldPage = await Bun.file("run/index.html").text();
const startupImages = oldPage.split("\n")
  .filter(line => line.includes("apple-touch-startup-image"))
  .map(line => line.replace("./splash_screens/", "./play/splash_screens/"))
  .join("\n");

// версия в адресе скрипта: после обновления браузер не возьмёт старый из кэша
const version = Date.now().toString(36);
const page = (await Bun.file("public/play.html").text())
  .replace("<!--STARTUP_IMAGES-->", startupImages)
  .replace("__VERSION__", version);
await Bun.write(`${SITE}/play.html`, page);

const readme = await marked.parse(await Bun.file("README.md").text());
await Bun.write(`${SITE}/index.html`, `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Бафия онлайн</title>
  <style>
    :root { color-scheme: light dark; }
    body { max-width: 760px; margin: 0 auto; padding: 24px 16px 48px; font: 16px/1.6 system-ui, sans-serif; }
    a { color: #d03a41; }
    pre { padding: 12px; overflow-x: auto; border-radius: 6px; background: rgba(127, 127, 127, .15); }
    code { font-family: ui-monospace, monospace; }
    h1, h2 { border-bottom: 1px solid rgba(127, 127, 127, .3); padding-bottom: .3em; }
  </style>
</head>
<body>
${readme}
</body>
</html>
`);

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} МБ`;
console.log(`Ассеты: ${assets.count} файлов, ${mb(assets.rawSize)} → образ ${mb(assets.packedSize)}`);
console.log(`Готово: ${SITE}/play.html (версия ${version}), старая версия: ${SITE}/run/index.html`);
