import { isPermission, type Permission } from "./permissions";

export interface Manifest {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  permissions: Permission[]
  /** домены, к которым можно ходить с разрешением `network` */
  domains: string[]
  /** https-адрес файла с описанием последней версии (см. update.ts); без него мод не проверяет обновления */
  updateUrl?: string
}

/** мод целиком: описание и код (один JS-файл, который выполняется в Web Worker) */
export interface ModPackage {
  manifest: Manifest
  code: string
  /** исходники для чтения (путь → текст); игра не проверяет их соответствие `code` */
  sources?: Record<string, string>
}

const MAX_CODE = 5 * 1024 * 1024;
const ID = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const DOMAIN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;

const text = (value: unknown, name: string, max: number, required = false): string | undefined => {
  if(value === undefined && !required) return undefined;
  if(typeof value != "string" || !value.trim() || value.length > max) throw new Error(`В манифесте мода неверно поле «${name}»`);
  return value.trim();
};

export function parseManifest(raw: unknown): Manifest {
  if(typeof raw != "object" || raw === null) throw new Error("Манифест мода должен быть объектом");
  const data = raw as Record<string, unknown>;

  const id = text(data.id, "id", 40, true)!;
  if(!ID.test(id)) throw new Error("id мода: 3–40 символов, только a-z, 0-9 и дефис");

  const list = data.permissions ?? [];
  if(!Array.isArray(list)) throw new Error("В манифесте мода неверно поле «permissions»");
  const unknown = list.filter(item => !isPermission(item));
  if(unknown.length) throw new Error(`Неизвестные разрешения: ${unknown.map(String).join(", ")}`);

  const domains = data.domains ?? [];
  if(!Array.isArray(domains) || domains.some(domain => typeof domain != "string" || !DOMAIN.test(domain))) throw new Error("В манифесте мода неверно поле «domains»");

  let updateUrl: string | undefined;
  if(data.updateUrl !== undefined) {
    try {
      const url = new URL(String(data.updateUrl));
      if(url.protocol != "https:" || url.href.length > 300 || url.username || url.password) throw new Error();
      updateUrl = url.href;
    } catch {
      throw new Error("В манифесте мода неверно поле «updateUrl»: нужен https-адрес");
    }
  }

  return {
    id,
    name: text(data.name, "name", 60, true)!,
    version: text(data.version, "version", 20, true)!,
    description: text(data.description, "description", 300),
    author: text(data.author, "author", 60),
    permissions: [...new Set(list as Permission[])],
    domains: [...new Set((domains as string[]).map(domain => domain.toLowerCase()))],
    updateUrl
  };
}

const MAX_SOURCES = 2 * 1024 * 1024;

function parseSources(raw: unknown): Record<string, string> | undefined {
  if(raw === undefined) return undefined;
  if(typeof raw != "object" || raw === null || Array.isArray(raw)) throw new Error("В файле мода неверно поле «sources»");
  const entries = Object.entries(raw);
  if(entries.length > 100) throw new Error("В файле мода слишком много исходников");

  let total = 0;
  for(const [path, text] of entries) {
    if(typeof text != "string" || !path || path.length > 200 || path.startsWith("/") || path.split("/").includes("..")) throw new Error("В файле мода неверно поле «sources»");
    total += text.length;
  }
  if(total > MAX_SOURCES) throw new Error("Исходники мода слишком большие (больше 2 МБ)");
  return entries.length ? Object.fromEntries(entries) as Record<string, string> : undefined;
}

/** файл мода: JSON `{ "manifest": {...}, "code": "...", "sources": {...} }` */
export function parsePackage(json: string): ModPackage {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("Файл мода - не JSON");
  }
  const data = (typeof raw == "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  if(typeof data.code != "string" || !data.code.trim()) throw new Error("В файле мода нет кода");
  if(data.code.length > MAX_CODE) throw new Error("Код мода слишком большой (больше 5 МБ)");
  return { manifest: parseManifest(data.manifest), code: data.code, sources: parseSources(data.sources) };
}
