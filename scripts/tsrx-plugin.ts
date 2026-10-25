import type { BunPlugin } from "bun";
import { compile } from "@tsrx/solid";
import { transformAsync } from "@babel/core";
import solid from "babel-preset-solid";
import typescript from "@babel/preset-typescript";

/**
 * .tsrx → (tsrx) → TSX с Solid-JSX → (babel-preset-solid) → JS с прямыми DOM-операциями
 * стили из `<style>` внутри компонента прикрепляются к странице при загрузке модуля
 */
export async function transform(source: string, path: string): Promise<string> {
  const { code, css } = compile(source, path);

  const result = await transformAsync(code, {
    filename: path.replace(/\.tsrx$/, ".tsx"),
    babelrc: false,
    configFile: false,
    sourceMaps: "inline",
    presets: [[solid, { generate: "dom", hydratable: false }], [typescript, { isTSX: true, allExtensions: true }]]
  });
  if(!result?.code) throw new Error(`Не удалось собрать ${path}`);

  if(!css?.trim()) return result.code;
  return `import { injectStyle as __injectStyle } from "@common/ui/style";\n__injectStyle(${JSON.stringify(path)}, ${JSON.stringify(css)});\n${result.code}`;
}

const plugin: BunPlugin = {
  name: "tsrx",
  setup(build) {
    build.onLoad({ filter: /\.tsrx$/ }, async({ path }) => ({
      contents: await transform(await Bun.file(path).text(), path),
      loader: "js"
    }));
  }
};

export default plugin;
