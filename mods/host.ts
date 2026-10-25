import type { Manifest } from "./manifest";
import { eventPermissions, isMenuTarget, isModEvent, isModMethod, methodPermissions, type MenuTarget, type ModEvent, type Permission } from "./permissions";

/** воркер с точки зрения хоста; в тестах вместо настоящего Worker - заглушка */
export interface WorkerLike {
  postMessage(message: unknown): void
  terminate(): void
  onmessage: ((event: { data: unknown }) => void) | null
  onerror: ((event: { message?: string }) => void) | null
}

export type PanelBlock = { type: "text", text: string } | { type: "button", id: string, text: string };

/** пункт, который мод добавил в контекстное меню */
export interface MenuItem {
  id: string
  label: string
}

/** строка, которую мод добавил в профиль игрока; `button` - кнопка справа от значения */
export interface ProfileRow {
  label: string
  value: string
  button?: { id: string, text: string }
}

export interface Panel {
  title: string
  blocks: PanelBlock[]
}

/** что мод может делать с игрой: реализует игра, хост лишь проверяет права */
export interface ModBackend {
  chatSend(text: string): void
  roomSay(text: string): void
  screenCurrent(): string | undefined
  roomPlayers(): unknown
  roomState(): unknown
  roomAct(index: number): void
  roomVote(index: number): void
  roomGiveUp(): void
  roomVoteKick(vote: boolean): void
  roomRehost(): Promise<void>
  profileOpen(playerObjectId: string): void
  accountInfo(): unknown
  notify(modName: string, text: string, options: { title?: string, kind?: "info" | "success" | "warning" | "error" }): void
  themeSet(modId: string, values: Record<string, unknown>): void
  themeClear(modId: string): void
  /** запрос в интернет: домены уже проверены хостом */
  fetchText(url: string): Promise<string>
  roomsEnter(roomId: string): void
  roomsWaitAndJoin(roomId: string): void
  clipboardWrite(text: string): Promise<void>
  uiDialog(modName: string, title: string | undefined, text: string): void
}

export interface ModStorage {
  get(key: string): unknown
  set(key: string, value: unknown): void
  remove(key: string): void
}

export type ModStatus = "running" | "stopped" | "crashed";

export interface RuntimeOptions {
  manifest: Manifest
  /** разрешения, которые игрок оставил включёнными (не больше заявленных в манифесте) */
  granted: ReadonlySet<Permission>
  backend: ModBackend
  storage: ModStorage
  spawn(): WorkerLike
  /** вызовов в секунду, после чего мод останавливается */
  callLimit?: number
  now?: () => number
}

const MAX_STORAGE_VALUE = 100_000;
const MAX_FETCH = 1_000_000;

/**
 * один запущенный мод. Всё, что приходит из воркера, считается недоверенным:
 * сообщение проверяется по форме, метод - по разрешению, частота - по лимиту
 */
export class ModRuntime {
  status: ModStatus = "stopped";
  panel?: Panel;
  error?: string;
  readonly log: string[] = [];
  onChange?: () => void;

  private worker?: WorkerLike;
  private subscribed = new Set<ModEvent>();
  private commands = new Set<string>();
  private recent: number[] = [];
  private menus = new Set<MenuTarget>();
  private profileSection = false;
  private asks = new Map<number, (value: unknown) => void>();
  private nextAsk = 1;

  constructor(private options: RuntimeOptions) {}

  get id() { return this.options.manifest.id; }

  start() {
    if(this.worker) return;
    const worker = this.options.spawn();
    this.worker = worker;
    this.status = "running";
    this.error = undefined;
    worker.onmessage = event => void this.receive(event.data);
    worker.onerror = event => this.fail(event.message || "Ошибка в коде мода");
    this.onChange?.();
  }

  stop(status: ModStatus = "stopped") {
    this.worker?.terminate();
    this.worker = undefined;
    this.subscribed.clear();
    this.commands.clear();
    this.menus.clear();
    this.profileSection = false;
    for(const resolve of this.asks.values()) resolve(undefined);
    this.asks.clear();
    this.panel = undefined;
    this.status = status;
    this.options.backend.themeClear(this.id);
    this.onChange?.();
  }

  /** событие игры: мод получает его, только если подписан и у него есть право */
  emit(event: ModEvent, data: unknown) {
    if(this.subscribed.has(event)) this.worker?.postMessage({ k: "event", event, data });
  }

  /** команда игрока («/hello мир»): true - команда принадлежит моду и обработана */
  runCommand(name: string, args: string[]): boolean {
    if(!this.commands.has(name)) return false;
    this.worker?.postMessage({ k: "command", name, args });
    return true;
  }

  action(id: string) {
    this.worker?.postMessage({ k: "action", id });
  }

  /** пункты меню мода для `target`; пусто, если мод не ответил вовремя */
  async menuItems(target: MenuTarget, data: unknown): Promise<MenuItem[]> {
    if(!this.menus.has(target)) return [];
    const answer = await this.ask({ what: "menu", target, data });
    const items: MenuItem[] = [];
    for(const item of (Array.isArray(answer) ? answer : []).slice(0, 12) as Record<string, unknown>[]) {
      if(typeof item?.id == "string" && typeof item.label == "string" && item.id.length <= 40 && item.label.trim()) items.push({ id: item.id, label: item.label.slice(0, 80) });
    }
    return items;
  }

  selectMenu(target: MenuTarget, itemId: string, data: unknown) {
    if(this.menus.has(target)) this.worker?.postMessage({ k: "select", target, itemId, data });
  }

  /** строки профиля от мода. Нужны оба права: показывать строки и читать статистику */
  async profileRows(data: unknown): Promise<ProfileRow[]> {
    if(!this.profileSection || !this.allowed("profile:read")) return [];
    const answer = await this.ask({ what: "profile", data });
    const rows: ProfileRow[] = [];
    for(const row of (Array.isArray(answer) ? answer : []).slice(0, 30) as Record<string, unknown>[]) {
      if(typeof row?.label != "string" || !(typeof row.value == "string" || typeof row.value == "number")) continue;
      const button = row.button as Record<string, unknown> | undefined;
      rows.push({
        label: row.label.slice(0, 60), value: String(row.value).slice(0, 200),
        button: typeof button?.id == "string" && typeof button.text == "string" ? { id: button.id.slice(0, 40), text: button.text.slice(0, 40) } : undefined
      });
    }
    return rows;
  }

  profileAction(actionId: string, data: unknown) {
    if(this.profileSection) this.worker?.postMessage({ k: "profileAction", actionId, data });
  }

  /** вопрос моду с ответом; не дольше полсекунды: меню не должно зависать из-за медленного мода */
  private ask(question: Record<string, unknown>, timeout = 500): Promise<unknown> {
    const worker = this.worker;
    if(!worker) return Promise.resolve(undefined);
    return new Promise(resolve => {
      const id = this.nextAsk++;
      const timer = setTimeout(() => { this.asks.delete(id); resolve(undefined); }, timeout);
      this.asks.set(id, value => { clearTimeout(timer); resolve(value); });
      worker.postMessage({ k: "ask", id, ...question });
    });
  }

  private fail(message: string) {
    this.error = message;
    this.stop("crashed");
  }

  private allowed(permission: Permission) {
    return this.options.granted.has(permission) && this.options.manifest.permissions.includes(permission);
  }

  private overLimit(): boolean {
    const now = (this.options.now ?? Date.now)();
    this.recent = this.recent.filter(time => now - time < 1000);
    this.recent.push(now);
    return this.recent.length > (this.options.callLimit ?? 100);
  }

  private async receive(message: unknown) {
    if(!this.worker || typeof message != "object" || message === null) return;
    const data = message as Record<string, unknown>;

    if(this.overLimit()) return this.fail("Мод слишком часто обращается к игре и остановлен");

    switch(data.k) {
      case "call": return this.handleCall(data);
      case "on": {
        if(!isModEvent(data.event)) return;
        if(this.allowed(eventPermissions[data.event])) this.subscribed.add(data.event);
        else this.addLog(`Нет разрешения ${eventPermissions[data.event]} для события ${data.event}`);
        return;
      }
      case "command": {
        if(typeof data.name != "string" || !/^[a-z0-9_-]{1,32}$/i.test(data.name)) return;
        if(this.allowed("commands")) this.commands.add(data.name.toLowerCase());
        else this.addLog("Нет разрешения commands");
        return;
      }
      case "panel": return this.setPanel(data.panel);
      case "answer": {
        const resolve = typeof data.id == "number" ? this.asks.get(data.id) : undefined;
        if(resolve) { this.asks.delete(data.id as number); resolve(data.value); }
        return;
      }
      case "menu": {
        if(!isMenuTarget(data.target)) return;
        if(this.allowed("ui:menu")) this.menus.add(data.target);
        else this.addLog("Нет разрешения ui:menu");
        return;
      }
      case "profile": {
        if(this.allowed("ui:profile")) this.profileSection = true;
        else this.addLog("Нет разрешения ui:profile");
        return;
      }
      case "log": return typeof data.text == "string" ? this.addLog(data.text) : undefined;
    }
  }

  private addLog(text: string) {
    this.log.push(text.slice(0, 500));
    if(this.log.length > 50) this.log.shift();
    this.onChange?.();
  }

  private setPanel(raw: unknown) {
    if(!this.allowed("ui:panel")) return this.addLog("Нет разрешения ui:panel");
    const data = raw as { title?: unknown, blocks?: unknown };
    if(typeof data?.title != "string" || !Array.isArray(data.blocks)) return;

    const blocks: PanelBlock[] = [];
    for(const block of data.blocks.slice(0, 50) as Record<string, unknown>[]) {
      if(block?.type == "text" && typeof block.text == "string") blocks.push({ type: "text", text: block.text.slice(0, 1000) });
      else if(block?.type == "button" && typeof block.id == "string" && typeof block.text == "string") blocks.push({ type: "button", id: block.id.slice(0, 40), text: block.text.slice(0, 60) });
    }
    this.panel = { title: data.title.slice(0, 60), blocks };
    this.onChange?.();
  }

  private async handleCall(data: Record<string, unknown>) {
    const id = data.id;
    if(typeof id != "number") return;
    const worker = this.worker;
    const answer = (ok: boolean, value?: unknown, error?: string) => {
      if(this.worker === worker) worker?.postMessage({ k: "result", id, ok, value, error });
    };

    const method = data.method;
    if(!isModMethod(method)) return answer(false, undefined, "Неизвестный метод");
    const permission = methodPermissions[method];
    if(!this.allowed(permission)) return answer(false, undefined, `Нет разрешения ${permission}`);

    try {
      answer(true, await this.run(method, Array.isArray(data.args) ? data.args : []));
    } catch(error) {
      answer(false, undefined, error instanceof Error ? error.message : String(error));
    }
  }

  private async run(method: keyof typeof methodPermissions, args: unknown[]): Promise<unknown> {
    const { backend, storage, manifest } = this.options;
    const [first, second] = args;
    const needText = () => {
      if(typeof first != "string" || !first.trim() || first.length > 500) throw new Error("Нужен текст до 500 символов");
      return first;
    };

    switch(method) {
      case "chat.send": return backend.chatSend(needText());
      case "room.say": return backend.roomSay(needText());
      case "screen.current": return backend.screenCurrent();
      case "room.players": return backend.roomPlayers();
      case "room.state": return backend.roomState();
      case "room.act":
        if(!Number.isInteger(first)) throw new Error("Нужен номер игрока");
        return backend.roomAct(first as number);
      case "room.vote":
        if(!Number.isInteger(first)) throw new Error("Нужен номер игрока");
        return backend.roomVote(first as number);
      case "room.giveUp": return backend.roomGiveUp();
      case "room.rehost": return backend.roomRehost();
      case "profile.open":
        if(typeof first != "string" || first.length > 64) throw new Error("Нужен id игрока");
        return backend.profileOpen(first);
      case "room.voteKick":
        if(typeof first != "boolean") throw new Error("Нужно true или false");
        return backend.roomVoteKick(first);
      case "account.info": return backend.accountInfo();
      case "notify": {
        const options = (typeof second == "object" && second !== null ? second : {}) as { title?: unknown, kind?: unknown };
        const kind = ["info", "success", "warning", "error"].includes(options.kind as string) ? options.kind as "info" | "success" | "warning" | "error" : undefined;
        return backend.notify(manifest.name, needText(), { title: typeof options.title == "string" && options.title.trim() ? options.title.slice(0, 80) : undefined, kind });
      }
      case "storage.get": return storage.get(String(first));
      case "storage.set":
        if(JSON.stringify(second ?? null).length > MAX_STORAGE_VALUE) throw new Error("Значение слишком большое");
        return storage.set(String(first), second);
      case "storage.remove": return storage.remove(String(first));
      case "theme.set":
        if(typeof first != "object" || first === null) throw new Error("Нужен объект с цветами");
        return backend.themeSet(manifest.id, first as Record<string, unknown>);
      case "theme.clear": return backend.themeClear(manifest.id);
      case "rooms.enter":
      case "rooms.waitAndJoin": {
        if(typeof first != "string" || first.length > 64) throw new Error("Нужен id комнаты");
        return method == "rooms.enter" ? backend.roomsEnter(first) : backend.roomsWaitAndJoin(first);
      }
      case "clipboard.write": return backend.clipboardWrite(needText());
      case "ui.dialog": {
        const dialog = first as { title?: unknown, text?: unknown } | undefined;
        if(typeof dialog?.text != "string" || !dialog.text.trim() || dialog.text.length > 2000) throw new Error("Нужен текст до 2000 символов");
        return backend.uiDialog(manifest.name, typeof dialog.title == "string" ? dialog.title.slice(0, 60) : undefined, dialog.text);
      }
      case "net.fetch": {
        const url = new URL(String(first));
        if(url.protocol != "https:" || !manifest.domains.includes(url.hostname.toLowerCase())) throw new Error(`Домен ${url.hostname} не указан в манифесте`);
        return (await backend.fetchText(url.href)).slice(0, MAX_FETCH);
      }
    }
  }
}
