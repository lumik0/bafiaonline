/**
 * образ с картинками одним файлом. Раскладка: [4 байта: длина JSON][JSON-оглавление][файлы подряд]
 * сжатие gzip поверх, base64 для вставки в .js (чтобы игра открывалась и с file://)
 */
export interface PackedFile {
  path: string
  size: number
  /** SHA-1 содержимого, hex */
  sha1: string
}

export interface AssetsMeta {
  files: PackedFile[]
}

export interface AssetFile extends PackedFile {
  data: Uint8Array
}

export function encodePack(files: AssetFile[]): Uint8Array {
  const index: AssetsMeta = { files: files.map(({ path, size, sha1 }) => ({ path, size, sha1 })) };
  const header = new TextEncoder().encode(JSON.stringify(index));
  const total = 4 + header.length + files.reduce((sum, file) => sum + file.data.length, 0);

  const out = new Uint8Array(total);
  new DataView(out.buffer).setUint32(0, header.length);
  out.set(header, 4);

  let offset = 4 + header.length;
  for(const file of files) {
    out.set(file.data, offset);
    offset += file.data.length;
  }
  return out;
}

export function decodePack(bytes: Uint8Array): AssetFile[] {
  if(bytes.length < 4) throw new Error("Образ ассетов повреждён");
  const headerLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  const index = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + headerLength))) as AssetsMeta;

  let offset = 4 + headerLength;
  return index.files.map(file => {
    const data = bytes.subarray(offset, offset + file.size);
    if(data.length != file.size) throw new Error(`Образ ассетов повреждён: файл ${file.path} обрезан`);
    offset += file.size;
    return { ...file, data };
  });
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for(let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for(let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
