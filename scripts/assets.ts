import { join, relative } from "node:path";
import { encodePack, toBase64, type AssetFile } from "../common/assets/pack";

async function readDirectory(root: string): Promise<AssetFile[]> {
  const files: AssetFile[] = [];
  for await (const path of new Bun.Glob("**/*").scan({ cwd: root, onlyFiles: true })) {
    if(path.endsWith(".DS_Store")) continue;
    const data = new Uint8Array(await Bun.file(join(root, path)).arrayBuffer());
    files.push({
      path: relative(".", path).replaceAll("\\", "/"),
      size: data.length,
      sha1: new Bun.CryptoHasher("sha1").update(data).digest("hex"),
      data
    });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/** собирает образ из папки: два скрипта - оглавление (мелкое) и данные (gzip в base64) */
export async function buildAssets(root = "game/assets") {
  const files = await readDirectory(root);
  const meta = { files: files.map(({ path, size, sha1 }) => ({ path, size, sha1 })) };
  const gzipped = Bun.gzipSync(encodePack(files) as Uint8Array<ArrayBuffer>);

  return {
    count: files.length,
    rawSize: files.reduce((sum, file) => sum + file.size, 0),
    packedSize: gzipped.length,
    metaJs: `(window.__bafia ??= {}).assetsMeta = ${JSON.stringify(meta)};\n`,
    dataJs: `(window.__bafia ??= {}).assetsData = "${toBase64(gzipped)}";\n`
  };
}
