import type { BunPlugin } from "bun";
import { dirname, resolve } from "node:path";
const cache = new Map<string, Promise<string>>();

/** время последнего изменения файлов мода: при правке код пересобирается (dev-сервер) */
function modifiedAt(entry: string): number {
  let latest = 0;
  for(const file of new Bun.Glob("**/*.{ts,json}").scanSync({ cwd: dirname(entry), absolute: true })) latest = Math.max(latest, Bun.file(file).lastModified);
  return latest;
}

/**
 * сборка мода идёт отдельным процессом: Bun.build внутри плагина другой сборки (`bun run build`) зависает
 * результат запоминается на время работы процесса
 */
function bundle(entry: string): Promise<string> {
  const key = `${entry}:${modifiedAt(entry)}`;
  let code = cache.get(key);
  if(!code) {
    code = (async() => {
      const child = Bun.spawn([process.execPath, resolve(import.meta.dir, "bundle-mod-cli.ts"), entry], { stdout: "pipe", stderr: "pipe" });
      const [out, err, status] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
      if(status != 0) throw new Error(`Не удалось собрать мод ${entry}:\n${err}`);
      return out;
    })();
    cache.set(key, code);
  }
  return code;
}

/**
 * `import code from "mod:official"` - код из `mods/official/index.ts`, собранный в строку
 * встроенный мод - обычный TypeScript с проверкой типов, попадает в игру как любой мод
 */
const plugin: BunPlugin = {
  name: "mod",
  setup(build) {
    // в пути остаётся только имя мода: полный путь к файлу строится при загрузке
    build.onResolve({ filter: /^mod:/ }, ({ path }) => ({ path: path.slice(4), namespace: "mod" }));
    build.onLoad({ filter: /.*/, namespace: "mod" }, async({ path }) => ({
      contents: `export default ${JSON.stringify(await bundle(resolve(import.meta.dir, "../mods", path, "index.ts")))};`,
      loader: "js"
    }));
  }
};

export default plugin;
