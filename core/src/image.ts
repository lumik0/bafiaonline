import FS, { FSType } from "./fs/fs";
import { createScript, decompress, error } from './utils/utils';
import CBOR from './lib/cbor';

async function writeToFS(
  toPath = "/",
  structure: Record<string, { data: Uint8Array, sha1: string }>,
  rewrite = false,
  start: (size: number) => void = () => {},
  process: (path: string, write: boolean) => void = () => {}
) {
  const entries = Object.entries(structure);
  start(entries.length);
  for(const [path, { data, sha1 }] of entries) {
    const filePath = `${toPath}${path}`;
    let shouldWrite = rewrite;

    if(!rewrite) {
      if(!(await FS.existsFile(filePath))) {
        shouldWrite = true;
      } else {
        const currentSha1 = await FS.getSHA1(filePath);
        if(currentSha1 !== sha1) shouldWrite = true;
      }
    }

    if(shouldWrite) {
      await FS.writeFile(filePath, data);
      process(filePath, true);
    } else {
      process(filePath, false);
    }
  }
}

export async function readImage(
  path: string,
  toPath = "/",
  rewrite = false,
  options?: { startProcessFS?: (size: number) => void, processFS?: (path: string, write: boolean) => void }
) {
  const obj = window
  let name = path.split('/').pop()?.split('.')[0] ?? "image";
  console.log(`Decompressing image ${path}..`);
  // @ts-ignore
  if(!obj[name]) throw error('Image not found');
  try { // @ts-ignore
    const compressed = new Uint8Array(obj[name]);
    const decompressed = await decompress(compressed);
    const imageArray = CBOR.decode(decompressed.buffer) as Array<{ path: string, data: Uint8Array, sha1: string }>;
    const image: Record<string, { data: Uint8Array, sha1: string }> = {};
    for(const entry of imageArray) {
      image[entry.path] = { data: entry.data, sha1: entry.sha1 };
    }
    // @ts-ignore
    delete obj[name];
    await writeToFS(toPath, image, rewrite, options?.startProcessFS, options?.processFS);
    return image;
  } catch(e) {
    throw error('Image loading error\nThe image may be corrupted', e);
  }
}
