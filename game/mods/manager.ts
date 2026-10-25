import type { ServerClient } from "@common/net";
import type { NotificationOptions } from "@common/ui/notifications/center";
import { copyText } from "@common/utils/clipboard";
import { JsonDocument, type FileStore } from "@common/storage";
import type { ThemeManager } from "@common/ui/theme";
import Events from "@common/utils/emitter";
import { checkForUpdate, downloadUpdate, hashText, ModRuntime, type ModBackend, type ModPackage, type ModStatus, type MenuItem, type Panel, type ProfileRow, type UpdateInfo, type WorkerLike } from "@mods/index";
import { isMenuTarget, isPermission, type MenuTarget, type Permission } from "@mods/permissions";
import { workerSource } from "@mods/runtime";
import type { Navigator } from "@common/ui/nav/navigator";
import type { RoomSession } from "../domain/room/session";
import type { Routes } from "../routes";
import { roomSnapshot } from "./snapshot";
import type { User } from "../domain/user";

/** установленный мод: пакет, включён ли он и какие разрешения игрок оставил включёнными */
export interface InstalledMod extends ModPackage {
  enabled: boolean
  granted: Permission[]
  /** SHA-256 кода мода: игрок может сверить его с тем, что опубликовал автор */
  sha256: string
}

interface ModsFile {
  version: 1
  mods: InstalledMod[]
}

const MODS_PATH = "/mods/installed.json";
const MAX_MODS = 30;

const document = (files: FileStore) => new JsonDocument<ModsFile>(files, {
  path: MODS_PATH,
  defaults: () => ({ version: 1, mods: [] }),
  migrate: raw => {
    const list = Array.isArray((raw as ModsFile | undefined)?.mods) ? (raw as ModsFile).mods : [];
    return {
      version: 1,
      mods: list.filter(mod => typeof mod?.code == "string" && typeof mod.manifest?.id == "string").map(mod => ({
        manifest: mod.manifest, code: mod.code, sources: mod.sources, enabled: !!mod.enabled, sha256: typeof mod.sha256 == "string" ? mod.sha256 : "",
        granted: (mod.granted ?? []).filter(permission => isPermission(permission) && mod.manifest.permissions.includes(permission))
      }))
    };
  }
});

export interface ModDeps {
  client: ServerClient
  files: FileStore
  theme: ThemeManager
  user: User
  /** нужен, чтобы моды знали, какой экран открыт */
  nav: Navigator<Routes>
  /** уведомление в углу экрана (как в macOS) */
  notify(options: NotificationOptions): void
  /** запись в буфер обмена; по умолчанию системный */
  writeClipboard?(text: string): Promise<void>
  /** окно с текстом по просьбе мода */
  alert(title: string, text: string): void | Promise<void>
  /** действия игры, которые мод может запросить: заход в комнату и ожидание места */
  actions: {
    enterRoom(roomId: string): void | Promise<void>
    waitAndJoin(roomId: string): void | Promise<void>
    /** выйти из комнаты и создать такую же заново */
    rehostRoom(session: RoomSession): Promise<void>
    openProfile(playerObjectId: string): void
  }
  /** загрузка текста по https для проверки и скачивания обновлений; в тестах подставляется заглушка */
  fetchText?(url: string): Promise<string>
  /** встроенные моды: есть у каждого, выключаются, но не удаляются */
  builtIn?: ModPackage[]
  /** воркер для кода мода; в тестах подставляется заглушка */
  spawn?(source: string): WorkerLike
}

export interface ModInfo {
  mod: InstalledMod
  status: ModStatus
  panel?: Panel
  error?: string
  log: readonly string[]
  /** автор опубликовал версию новее установленной */
  update?: UpdateInfo
  updateError?: string
  /** встроенный мод: удалить нельзя */
  builtIn: boolean
}

/** пункт меню от конкретного мода */
export interface MenuEntry extends MenuItem {
  modId: string
}

export interface ProfileSection {
  modId: string
  modName: string
  rows: ProfileRow[]
}

const CHECK_INTERVAL = 60 * 60 * 1000;

/** без cookie и без перенаправлений: описание и файл обновления должны лежать ровно там, где указал автор */
const fetchPlain = async(url: string) => {
  const response = await fetch(url, { credentials: "omit", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
};

function spawnWorker(source: string): WorkerLike {
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  const worker = new Worker(url);
  const terminate = worker.terminate.bind(worker);
  worker.terminate = () => { terminate(); URL.revokeObjectURL(url); };
  return worker as unknown as WorkerLike;
}

/** моды одной игры (одного окна): установка, включение, права, запуск в воркерах и связь с игрой */
export class ModManager extends Events<{ change: () => void }> {
  private doc: JsonDocument<ModsFile>;
  private installed: InstalledMod[] = [];
  private runtimes = new Map<string, ModRuntime>();
  private room?: RoomSession;
  private lastRoomState = "";
  private storage = new Map<string, Record<string, unknown>>();
  private updates = new Map<string, UpdateInfo>();
  private updateErrors = new Map<string, string>();
  private lastCheck = 0;
  private handles: { remove(): void }[] = [];

  constructor(private deps: ModDeps) {
    super();
    this.doc = document(deps.files);
  }

  async start() {
    this.installed = (await this.doc.read()).mods;
    for(const mod of this.installed) mod.sha256 ||= await hashText(mod.code);
    await this.syncBuiltIn();
    for(const mod of this.installed) if(mod.enabled) await this.launch(mod);

    this.handles.push(this.deps.nav.on("change", transition => { this.emitAll("screen:change", { name: transition.to.name }); }));
    this.handles.push(this.deps.client.on("message", message => {
      // в ответе на вход лежит токен аккаунта: его моды не получают ни при каких правах
      if(message.name != "signedIn") this.emitAll("packet", { name: message.name, data: message.raw });
      if(message.name == "chatMessage") {
        const { message: chat } = message.data;
        const event = { username: chat.user?.username, text: chat.text };
        this.emitAll(this.room ? "room:message" : "chat:message", event);
      }
    }));
    this.emit("change");
  }

  stop() {
    for(const handle of this.handles) handle.remove();
    this.handles = [];
    for(const runtime of this.runtimes.values()) runtime.stop();
    this.runtimes.clear();
  }

  get list(): ModInfo[] {
    return this.installed.map(mod => {
      const runtime = this.runtimes.get(mod.manifest.id);
      const id = mod.manifest.id;
      return {
        mod, status: runtime?.status ?? "stopped", panel: runtime?.panel, error: runtime?.error, log: runtime?.log ?? [],
        update: this.updates.get(id), updateError: this.updateErrors.get(id), builtIn: this.isBuiltIn(id)
      };
    });
  }

  isBuiltIn(id: string) { return !!this.deps.builtIn?.some(pack => pack.manifest.id == id); }

  /**
   * встроенные моды приезжают вместе с игрой: при первом запуске ставятся включёнными со всеми разрешениями,
   * при обновлении игры подтягивается новый код; выбор игрока сохраняется
   * новые разрешения встроенного мода включаются сами - это код самой игры
   */
  private async syncBuiltIn() {
    for(const pack of this.deps.builtIn ?? []) {
      const sha256 = await hashText(pack.code);
      const old = this.installed.find(mod => mod.manifest.id == pack.manifest.id);
      if(!old) {
        this.installed.unshift({ ...pack, enabled: true, granted: [...pack.manifest.permissions], sha256 });
        continue;
      }
      const added = pack.manifest.permissions.filter(permission => !old.manifest.permissions.includes(permission));
      Object.assign(old, { manifest: pack.manifest, code: pack.code, sources: pack.sources, sha256 });
      old.granted = [...old.granted.filter(permission => pack.manifest.permissions.includes(permission)), ...added];
    }
    if(this.deps.builtIn?.length) await this.save();
  }

  find(id: string) { return this.installed.find(mod => mod.manifest.id == id); }

  /** добавляет или обновляет мод; новые разрешения выключены, пока игрок не подтвердит */
  async install(pack: ModPackage, grantAll: boolean): Promise<void> {
    if(this.isBuiltIn(pack.manifest.id)) throw new Error("Этот id занят встроенным модом");
    const old = this.find(pack.manifest.id);
    if(!old && this.installed.length >= MAX_MODS) throw new Error("Установлено слишком много модов");

    const granted = grantAll ? [...pack.manifest.permissions] : (old?.granted ?? []).filter(permission => pack.manifest.permissions.includes(permission));
    const mod: InstalledMod = { ...pack, enabled: old?.enabled ?? false, granted, sha256: await hashText(pack.code) };
    this.updates.delete(mod.manifest.id);

    this.runtimes.get(mod.manifest.id)?.stop();
    this.runtimes.delete(mod.manifest.id);
    this.installed = [...this.installed.filter(other => other.manifest.id != mod.manifest.id), mod];
    await this.save();
    if(mod.enabled) await this.launch(mod);
    this.emit("change");
  }

  /**
   * спрашивает у авторов (только у модов с `updateUrl`), нет ли новых версий. Ничего не скачивает и не ставит
   * раз в час не чаще, если не `force`: адрес автора видит IP игрока, лишних запросов быть не должно
   */
  async checkUpdates(force = false) {
    if(!force && Date.now() - this.lastCheck < CHECK_INTERVAL) return;
    this.lastCheck = Date.now();
    const fetchText = this.deps.fetchText ?? fetchPlain;

    await Promise.all(this.installed.filter(mod => mod.manifest.updateUrl).map(async mod => {
      const id = mod.manifest.id;
      try {
        const info = await checkForUpdate(mod.manifest, fetchText);
        if(info) this.updates.set(id, info); else this.updates.delete(id);
        this.updateErrors.delete(id);
      } catch(error) {
        this.updateErrors.set(id, error instanceof Error ? error.message : String(error));
      }
    }));
    this.emit("change");
  }

  /** скачивает и проверяет новую версию для подтверждения игроком */
  async prepareUpdate(id: string): Promise<ModPackage> {
    const mod = this.find(id), info = this.updates.get(id);
    if(!mod || !info) throw new Error("Обновления нет");
    return downloadUpdate(mod.manifest, info, this.deps.fetchText ?? fetchPlain);
  }

  async setEnabled(id: string, enabled: boolean) {
    const mod = this.find(id);
    if(!mod) return;
    mod.enabled = enabled;
    await this.relaunch(mod);
  }

  async setGranted(id: string, permission: Permission, on: boolean) {
    const mod = this.find(id);
    if(!mod || !mod.manifest.permissions.includes(permission)) return;
    mod.granted = on ? [...new Set([...mod.granted, permission])] : mod.granted.filter(other => other != permission);
    await this.relaunch(mod);
  }

  async remove(id: string) {
    if(this.isBuiltIn(id)) throw new Error("Встроенный мод нельзя удалить, только выключить");
    this.runtimes.get(id)?.stop();
    this.runtimes.delete(id);
    this.installed = this.installed.filter(mod => mod.manifest.id != id);
    this.storage.delete(id);
    await this.deps.files.remove(`/mods/data/${id}.json`);
    await this.save();
    this.emit("change");
  }

  /** «/команда аргументы»: true, если команду выполнил мод (тогда в чат её не отправляем) */
  runCommand(text: string): boolean {
    if(!text.startsWith("/")) return false;
    const [name = "", ...args] = text.slice(1).trim().split(/\s+/);
    for(const runtime of this.runtimes.values()) if(runtime.runCommand(name.toLowerCase(), args)) return true;
    return false;
  }

  /** пункты, которые моды добавляют в меню `target`; у каждого - id мода, чтобы выбор вернулся к нему */
  async menuItems(target: MenuTarget, data: unknown): Promise<MenuEntry[]> {
    const lists = await Promise.all([...this.runtimes].map(async([modId, runtime]) => (await runtime.menuItems(target, data)).map(item => ({ ...item, modId }))));
    return lists.flat();
  }

  selectMenu(entry: MenuEntry, target: MenuTarget, data: unknown) {
    if(isMenuTarget(target)) this.runtimes.get(entry.modId)?.selectMenu(target, entry.id, data);
  }

  /** блоки профиля от модов; пустые не возвращаются */
  async profileSections(data: unknown): Promise<ProfileSection[]> {
    const sections = await Promise.all([...this.runtimes].map(async([modId, runtime]) => ({
      modId, modName: this.find(modId)?.manifest.name ?? modId, rows: await runtime.profileRows(data)
    })));
    return sections.filter(section => section.rows.length);
  }

  profileAction(modId: string, actionId: string, data: unknown) {
    this.runtimes.get(modId)?.profileAction(actionId, data);
  }

  panelAction(id: string, action: string) {
    this.runtimes.get(id)?.action(action);
  }

  /** комната, в которой сейчас игрок: нужна модам для событий и действий; возвращает отписку */
  attachRoom(session: RoomSession): () => void {
    this.room = session;
    this.lastRoomState = "";
    const handle = session.on("change", () => {
      const summary = roomSnapshot(session.state);
      const text = JSON.stringify(summary);
      if(text == this.lastRoomState) return;
      this.lastRoomState = text;
      this.emitAll("room:state", summary);
    });
    return () => {
      handle.remove();
      if(this.room === session) this.room = undefined;
    };
  }

  private emitAll(event: Parameters<ModRuntime["emit"]>[0], data: unknown) {
    for(const runtime of this.runtimes.values()) runtime.emit(event, data);
  }

  private async relaunch(mod: InstalledMod) {
    this.runtimes.get(mod.manifest.id)?.stop();
    this.runtimes.delete(mod.manifest.id);
    await this.save();
    if(mod.enabled) await this.launch(mod);
    this.emit("change");
  }

  private save() {
    return this.doc.write({ version: 1, mods: this.installed });
  }

  private async modStorage(id: string): Promise<Record<string, unknown>> {
    const cached = this.storage.get(id);
    if(cached) return cached;
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(await this.deps.files.read(`/mods/data/${id}.json`) ?? "{}");
    } catch {
      // повреждённое хранилище мода начинаем заново
    }
    this.storage.set(id, data);
    return data;
  }

  private async launch(mod: InstalledMod) {
    const id = mod.manifest.id;
    const data = await this.modStorage(id);
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    const persist = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => void this.deps.files.write(`/mods/data/${id}.json`, JSON.stringify(data)), 300);
    };

    const runtime = new ModRuntime({
      manifest: mod.manifest,
      granted: new Set(mod.granted),
      backend: this.backend(),
      storage: {
        get: key => data[key],
        set: (key, value) => { data[key] = value; persist(); },
        remove: key => { delete data[key]; persist(); }
      },
      spawn: () => (this.deps.spawn ?? spawnWorker)(workerSource(mod.code, mod.granted))
    });
    runtime.onChange = () => this.emit("change");
    this.runtimes.set(id, runtime);
    runtime.start();
  }

  private needRoom(): RoomSession {
    if(!this.room) throw new Error("Ты не в комнате");
    return this.room;
  }

  private backend(): ModBackend {
    const { client, theme, user, notify } = this.deps;
    return {
      chatSend: text => client.send("sendChatMessage", { message: { text, style: 0, sticker: false } }),
      roomSay: text => this.needRoom().send(text),
      screenCurrent: () => this.deps.nav.top?.name,
      roomPlayers: () => {
        const { players } = roomSnapshot(this.needRoom().state);
        return players.map(({ index, username, alive }) => ({ index, username, alive }));
      },
      roomState: () => this.room ? roomSnapshot(this.room.state) : null,
      roomAct: index => {
        const { state } = this.needRoom();
        const target = state.players[index];
        if(!target) throw new Error("Нет такого игрока");
        // игра разрешает только возможные ходы, иначе мод может подставить игрока под бан
        if(!state.actionFor(target)) throw new Error("Сейчас так сходить нельзя");
        this.needRoom().act(target.playerObjectId);
      },
      roomVote: index => {
        const { state } = this.needRoom();
        const target = state.players[index];
        if(!target) throw new Error("Нет такого игрока");
        if(state.status != 3 || state.dayTime != 3 || !state.actionFor(target)) throw new Error("Сейчас нельзя голосовать за этого игрока");
        this.needRoom().act(target.playerObjectId);
      },
      roomGiveUp: () => {
        if(!this.needRoom().state.canGiveUp) throw new Error("Сейчас сдаться нельзя");
        this.needRoom().giveUp();
      },
      roomVoteKick: vote => {
        const room = this.needRoom();
        if(!room.kickVote || room.kickVote.voted) throw new Error("Сейчас нет голосования за исключение");
        room.voteKick(vote);
      },
      accountInfo: () => ({ username: user.username, level: user.level, playerObjectId: user.playerObjectId }),
      notify: (modName, text, options) => notify({ source: modName, title: options.title ?? text, text: options.title ? text : undefined, kind: options.kind }),
      themeSet: (id, values) => theme.setLayer("mod:" + id, values),
      themeClear: id => theme.setLayer("mod:" + id),
      fetchText: async url => (await fetch(url, { credentials: "omit" })).text(),
      roomRehost: () => this.deps.actions.rehostRoom(this.needRoom()),
      profileOpen: id => this.deps.actions.openProfile(id),
      roomsEnter: id => void this.deps.actions.enterRoom(id),
      roomsWaitAndJoin: id => void this.deps.actions.waitAndJoin(id),
      clipboardWrite: async text => { await (this.deps.writeClipboard ?? copyText)(text); },
      uiDialog: (modName, title, text) => void this.deps.alert(title ?? modName, text)
    };
  }
}
