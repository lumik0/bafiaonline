import { randomId } from "../../utils/digest";
import Events from "../../utils/emitter";
import { JsonDocument } from "../../storage/document";
import type { FileStore } from "../../storage/files";
import { defaultPresetId, effects, getPreset, isBuiltIn, presets } from "./presets";
import { getToken, isValidValue, tokens, type ThemeValues, type TokenKey } from "./tokens";

export const THEME_PATH = "/theme.json";
const SAVE_DELAY = 300;

/** тема игрока: основа (встроенный пресет) и личные правки поверх неё */
export interface StoredTheme {
  id: string
  name: string
  /** встроенный пресет, значения которого лежат под правками; у своих тем - «Классика» */
  base: string
  /** выбранный эффект; пока не выбран - тот, что у основы темы */
  effect?: string
  overrides: Partial<Record<TokenKey, string>>
}

/** что хранится у игрока: все темы и выбранная. Встроенные («Классика», «Полночь») есть всегда */
export interface ThemeSettings {
  version: 2
  active: string
  themes: StoredTheme[]
}

export interface ThemeInfo {
  id: string
  name: string
  builtIn: boolean
}

export interface ThemeExport {
  format: "bafiaonline-theme"
  version: 1
  name?: string
  preset: string
  effect?: string
  overrides: Partial<Record<TokenKey, string>>
}

/** куда выставляются CSS-переменные: `document.documentElement`, элемент окна или заглушка в тестах */
export interface StyleTarget {
  style: { setProperty(name: string, value: string): void, removeProperty(name: string): void }
}

/** оставляет только известные токены с допустимыми значениями; всё остальное молча отбрасывается */
function sanitizeOverrides(raw: unknown): StoredTheme["overrides"] {
  const overrides: Record<string, string> = {};
  if(typeof raw != "object" || raw === null) return overrides;

  for(const [key, value] of Object.entries(raw)) {
    const token = getToken(key);
    if(token && isValidValue(token.kind, value)) overrides[key] = value.trim();
  }
  return overrides;
}

const validEffect = (id: unknown) => effects.some(effect => effect.id == id) ? id as string : undefined;

const builtInThemes = (): StoredTheme[] => presets.map(preset => ({ id: preset.id, name: preset.label, base: preset.id, overrides: {} }));

const defaults = (): ThemeSettings => ({ version: 2, active: defaultPresetId, themes: builtInThemes() });

const cleanName = (name: unknown, fallback: string) => typeof name == "string" && name.trim() ? name.trim().slice(0, 40) : fallback;

/** читает файл любой версии. Первая версия хранила один пресет с правками: они переходят в выбранную тему */
function migrate(raw: unknown): ThemeSettings {
  const data = (typeof raw == "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const settings = defaults();

  if(Array.isArray(data.themes)) {
    for(const item of data.themes as Partial<StoredTheme>[]) {
      if(typeof item?.id != "string") continue;
      const builtIn = settings.themes.find(theme => theme.id == item.id);
      if(builtIn) {
        builtIn.overrides = sanitizeOverrides(item.overrides);
        builtIn.effect = validEffect(item.effect);
      }
      else if(!isBuiltIn(item.id)) {
        settings.themes.push({
          id: item.id,
          name: cleanName(item.name, "Тема"),
          base: typeof item.base == "string" && getPreset(item.base) ? item.base : defaultPresetId,
          effect: validEffect(item.effect),
          overrides: sanitizeOverrides(item.overrides)
        });
      }
    }
    if(typeof data.active == "string" && settings.themes.some(theme => theme.id == data.active)) settings.active = data.active;
  } else if(data.overrides) {
    // версия 1; удалённая «Светлая» превращается в классику
    const id = typeof data.preset == "string" && getPreset(data.preset) ? data.preset : defaultPresetId;
    settings.themes.find(theme => theme.id == id)!.overrides = sanitizeOverrides(data.overrides);
    settings.active = id;
  } else if(typeof data.preset == "string" && getPreset(data.preset)) {
    settings.active = data.preset;
  }
  return settings;
}

export class ThemeManager extends Events<{ change: (changed: TokenKey[]) => void }> {
  private settings = defaults();
  private applied = new Map<string, string>();
  /** временные слои поверх темы (например, от мода): не сохраняются и пропадают при закрытии */
  private layers = new Map<string, StoredTheme["overrides"]>();
  private document?: JsonDocument<ThemeSettings>;
  private saveTimer?: ReturnType<typeof setTimeout>;

  constructor(private target: StyleTarget, files?: FileStore) {
    super();
    if(files) this.document = new JsonDocument(files, { path: THEME_PATH, defaults, migrate });
    this.apply();
  }

  private get current(): StoredTheme {
    return this.settings.themes.find(theme => theme.id == this.settings.active)!;
  }

  get active(): string { return this.settings.active; }
  get overrides(): Readonly<StoredTheme["overrides"]> { return this.current.overrides; }

  get themes(): ThemeInfo[] {
    return this.settings.themes.map(({ id, name }) => ({ id, name, builtIn: isBuiltIn(id) }));
  }

  /** итоговые значения: основа темы, поверх неё правки игрока */
  get values(): ThemeValues {
    const { base, overrides } = this.current;
    return Object.assign({}, getPreset(base)!.values, overrides, ...this.layers.values()) as ThemeValues;
  }

  /** временные цвета поверх темы; `undefined` убирает слой. Неподходящие значения отбрасываются */
  setLayer(id: string, values?: Record<string, unknown>) {
    if(values) this.layers.set(id, sanitizeOverrides(values));
    else if(!this.layers.delete(id)) return;
    this.changed();
  }

  /** эффект выбранной темы: свой, иначе тот, что задан у основы */
  get effect(): string {
    const { effect, base } = this.current;
    return effect ?? getPreset(base)?.effect ?? "none";
  }

  isOverridden(key: TokenKey) { return key in this.current.overrides; }

  async load() {
    if(!this.document) return;
    this.settings = await this.document.read();
    this.apply();
  }

  /** возвращает false, если значение не подходит токену (например, "red; display:none") */
  set(key: TokenKey, value: string): boolean {
    const token = getToken(key);
    if(!token || !isValidValue(token.kind, value)) return false;
    this.current.overrides[key] = value.trim();
    this.changed();
    return true;
  }

  reset(key: TokenKey) {
    if(!(key in this.current.overrides)) return;
    delete this.current.overrides[key];
    this.changed();
  }

  resetAll() {
    this.current.overrides = {};
    this.changed();
  }

  select(id: string): boolean {
    if(!this.settings.themes.some(theme => theme.id == id)) return false;
    this.settings.active = id;
    this.changed();
    return true;
  }

  setEffect(id: string): boolean {
    if(!effects.some(effect => effect.id == id)) return false;
    this.current.effect = id;
    this.changed();
    return true;
  }

  /** новая тема начинается как «Классика» и сразу выбирается */
  create(name: string): string {
    const id = "theme-" + randomId();
    this.settings.themes.push({ id, name: cleanName(name, "Новая тема"), base: defaultPresetId, overrides: {} });
    this.settings.active = id;
    this.changed();
    return id;
  }

  rename(id: string, name: string): boolean {
    const theme = this.settings.themes.find(other => other.id == id);
    if(!theme || isBuiltIn(id)) return false;
    theme.name = cleanName(name, theme.name);
    this.changed();
    return true;
  }

  /** встроенные темы не удаляются. Если удалили выбранную - выбирается «Классика» */
  remove(id: string): boolean {
    if(isBuiltIn(id) || !this.settings.themes.some(theme => theme.id == id)) return false;
    this.settings.themes = this.settings.themes.filter(theme => theme.id != id);
    if(this.settings.active == id) this.settings.active = defaultPresetId;
    this.changed();
    return true;
  }

  exportJson(): string {
    const { name, base, overrides } = this.current;
    const data: ThemeExport = { format: "bafiaonline-theme", version: 1, name, preset: base, effect: this.effect, overrides };
    return JSON.stringify(data, null, 2);
  }

  /** тема из файла добавляется и выбирается; плохие значения пропускаются */
  importJson(json: string): number {
    const data = JSON.parse(json) as Partial<ThemeExport>;
    if(data?.format != "bafiaonline-theme") throw new Error("Это не файл темы Бафии");

    const overrides = sanitizeOverrides(data.overrides);
    const base = typeof data.preset == "string" && getPreset(data.preset) ? data.preset : defaultPresetId;
    const id = "theme-" + randomId();
    this.settings.themes.push({ id, name: cleanName(data.name, "Импортированная"), base, effect: validEffect(data.effect), overrides });
    this.settings.active = id;
    this.changed();
    return Object.keys(overrides).length;
  }

  /** записать на диск немедленно (например, перед закрытием окна) */
  async flush() {
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    await this.document?.write(this.settings);
  }

  private changed() {
    // список тем мог измениться, даже если ни один цвет не поменялся
    this.emit("change", this.apply());
    this.scheduleSave();
  }

  /** трогает только изменившиеся переменные, чтобы ползунок не пересчитывал остальные */
  private apply(): TokenKey[] {
    const values = this.values;
    const changed: TokenKey[] = [];

    for(const { key } of tokens) {
      const value = values[key as TokenKey];
      if(this.applied.get(key) === value) continue;
      this.target.style.setProperty(`--${key}`, value);
      this.applied.set(key, value);
      changed.push(key as TokenKey);
    }
    return changed;
  }

  private scheduleSave() {
    if(!this.document) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), SAVE_DELAY);
  }
}

export { presets };
