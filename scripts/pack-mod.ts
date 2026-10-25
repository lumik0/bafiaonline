// bun scripts/pack-mod.ts mods/examples/hello - собирает мод в <id>.bafiamod.json
import { hashText } from "../mods/hash";
import { bundleMod } from "./bundle-mod";
import { parsePackage } from "../mods/manifest";

const dir = process.argv[2];
if(!dir) {
  console.error("Укажи папку мода: bun scripts/pack-mod.ts <папка>");
  process.exit(1);
}

const manifest = await Bun.file(`${dir}/manifest.json`).json();
const entry = [`${dir}/index.ts`, `${dir}/index.js`].find(path => Bun.file(path).size > 0);
if(!entry) {
  console.error(`В ${dir} нет index.ts или index.js`);
  process.exit(1);
}

const code = await bundleMod(entry);

// проверка тем же разбором, что и в игре
const pack = parsePackage(JSON.stringify({ manifest, code }));

const out = `${dir}/${pack.manifest.id}.bafiamod.json`;
// исходники кладём рядом, чтобы игрок мог их прочитать
const sources: Record<string, string> = {};
for await(const path of new Bun.Glob("**/*.{ts,tsx,js,mjs}").scan({ cwd: dir })) {
  if(path.includes("node_modules") || path.endsWith(".d.ts") || path.startsWith(".")) continue;
  sources[path] = await Bun.file(`${dir}/${path}`).text();
}

const file = JSON.stringify({ manifest: pack.manifest, code: pack.code, sources }, null, 2);
await Bun.write(out, file);

// описание версии для проверки обновлений: выкладывается по адресу updateUrl рядом с файлом мода
const sha256 = await hashText(file, "SHA-256"), sha1 = await hashText(file, "SHA-1");
const update = `${dir}/${pack.manifest.id}.update.json`;
await Bun.write(update, JSON.stringify({ version: pack.manifest.version, file: `${pack.manifest.id}.bafiamod.json`, sha256, sha1 }, null, 2));

console.log(`Готово: ${out} (${pack.manifest.permissions.length} разрешений, ${(code.length / 1024).toFixed(1)} КБ)`);
console.log(`SHA-256: ${sha256}\nSHA-1:   ${sha1}`);
console.log(`Описание версии: ${update}${pack.manifest.updateUrl ? "" : " (в манифесте нет updateUrl - игра не будет проверять обновления)"}`);
