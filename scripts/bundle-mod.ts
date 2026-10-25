import type { BunPlugin } from "bun";

/** "bafia:api" - не настоящий пакет: в воркере `mod` уже лежит в глобальной области, импорт лишь даёт типы */
const bafiaApi: BunPlugin = {
  name: "bafia-api",
  setup(build) {
    build.onResolve({ filter: /^bafia:api$/ }, () => ({ path: "bafia-api", namespace: "bafia" }));
    build.onLoad({ filter: /.*/, namespace: "bafia" }, () => ({ contents: "export const mod = globalThis.mod;", loader: "js" }));
  }
};

/** собирает мод (index.ts и всё, что он импортирует) в один скрипт для воркера */
export async function bundleMod(entry: string): Promise<string> {
  const result = await Bun.build({ entrypoints: [entry], target: "browser", format: "iife", plugins: [bafiaApi] });
  if(!result.success) throw new Error(result.logs.map(String).join("\n"));
  return result.outputs[0]!.text();
}
