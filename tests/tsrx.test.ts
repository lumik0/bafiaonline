import { expect, test } from "bun:test";
import { transform } from "../scripts/tsrx-plugin";

// ошибки в .tsrx видны только при сборке; этот тест ловит их без запуска браузера
test("все .tsrx-файлы проекта компилируются", async() => {
  const files = [...new Bun.Glob("{common,game,launcher,mods,dev}/**/*.tsrx").scanSync(".")];
  expect(files.length).toBeGreaterThan(0);

  for(const file of files) {
    const result = await transform(await Bun.file(file).text(), `${process.cwd()}/${file}`).catch(error => error as Error);
    expect(typeof result == "string" ? "" : `${file}: ${result.message}`).toBe("");
  }
});
