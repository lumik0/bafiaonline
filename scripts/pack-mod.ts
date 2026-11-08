// bun scripts/pack-mod.ts mods/examples/hello [--key author.key.json] - собирает мод в <id>.bafiamod.json; с --key подписывает его ключом автора
// (нет файла ключа - создаёт новый; его закрытую часть нельзя никому отдавать)
import { hashText } from "../mods/hash";
import { bundleMod } from "./bundle-mod";
import { parsePackage } from "../mods/manifest";
import { generateAuthorKey, keyId, signMod, type AuthorKey } from "../mods/signing";
import { existsSync } from "node:fs";

const args = process.argv.slice(2);
const keyIndex = args.indexOf("--key");
const keyPath = keyIndex >= 0 ? args[keyIndex + 1] : undefined;
if(keyIndex >= 0 && !keyPath) { console.error("После --key укажи файл ключа: --key author.key.json"); process.exit(1); }
const dir = args.find((arg, index) => !arg.startsWith("--") && index != keyIndex + 1);
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

// подпись автора: id, версия, ник автора и хеш кода; ник должен быть ником в Бафии, по нему мод связывают с автором
let signature;
if(keyPath) {
  if(!pack.manifest.author) { console.error("Чтобы подписать мод, укажи в manifest.json поле author: твой ник в Бафии"); process.exit(1); }
  let key: AuthorKey;
  if(existsSync(keyPath)) key = await Bun.file(keyPath).json();
  else {
    key = await generateAuthorKey();
    await Bun.write(keyPath, JSON.stringify(key, null, 2) + "\n");
    console.log(`Создан новый ключ автора: ${keyPath}. Храни его в надёжном месте и никому не отдавай: с ним подписывают все твои моды.`);
  }
  signature = await signMod(pack.manifest, pack.code, key);
  console.log(`Подписано ключом ${await keyId(key.publicKey)} (автор: ${pack.manifest.author})`);
}

const file = JSON.stringify({ manifest: pack.manifest, code: pack.code, sources, signature }, null, 2);
await Bun.write(out, file);

// описание версии для проверки обновлений: выкладывается по адресу updateUrl рядом с файлом мода
const sha256 = await hashText(file, "SHA-256"), sha1 = await hashText(file, "SHA-1");
const update = `${dir}/${pack.manifest.id}.update.json`;
await Bun.write(update, JSON.stringify({ version: pack.manifest.version, file: `${pack.manifest.id}.bafiamod.json`, sha256, sha1 }, null, 2));

console.log(`Готово: ${out} (${pack.manifest.permissions.length} разрешений, ${(code.length / 1024).toFixed(1)} КБ)`);
console.log(`SHA-256: ${sha256}\nSHA-1:   ${sha1}`);
console.log(`Описание версии: ${update}${pack.manifest.updateUrl ? "" : " (в манифесте нет updateUrl - игра не будет проверять обновления)"}`);
