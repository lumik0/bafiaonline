import { sanitizeRecord, type HistoryRecord } from "./history";
import { isPremiumColor, PREMIUM_COLORS, BAFIA_LIMITS, BAFIA_PROTOCOL_VERSION, GIF_FILE_PATH, isGifUrl, type GifItem, type NickRecord, type SeenPlayer, type ServerMessage } from "@common/bafia/protocol";
import type { SocketLike } from "@common/net/connection";
import { Connection } from "@common/net/connection";
import Events from "@common/utils/emitter";
import { toBase64 } from "@common/assets/pack";
import { searchGiphy } from "./giphy";

export interface BafiaLinkOptions {
  url: string
  key: string
  createSocket?: (url: string) => SocketLike
  /** адрес сервера для файлов (http), откуда берутся загруженные игроками гифки */
  fileBase?: string
  /** для тестов: запросы к Giphy */
  fetch?: typeof fetch
  /** сколько ждать ответа, мс: сервер Бафии необязателен, игра из-за него не ждёт */
  timeout?: number
  backoff?: number[]
  delay?: (ms: number) => Promise<void>
}

/**
 * связь с сервером Бафии; при ошибке или молчании просто пустой результат
 * уходят только ник, публичный id, случайный ключ установки и счётчики партий
 */
export class BafiaLink extends Events<{ change: () => void }> {
  private connection: Connection;
  private pending = new Map<number, (message: ServerMessage | undefined) => void>();
  private counter = 0;
  private identity?: SeenPlayer;
  /** до какого времени (мс) действует премиум на этой установке */
  premiumUntil?: number;
  /** игроки из последних ответов «кто в Бафии», у которых премиум */
  premiumOnline = new Set<string>();
  /** цвета их значков (название из PREMIUM_COLORS) */
  premiumColors = new Map<string, string>();
  /** мой выбранный цвет: отправляется серверу, когда есть премиум */
  color?: string;
  /** код, который активируется сам при подключении, если премиума ещё нет */
  savedCode?: string;
  private ready = false;
  /** ключ Giphy, который выдал сервер: без него поиск идёт только по каталогу сервера */
  private gifKey?: string;
  get isReady() { return this.ready; }
  /** кто из спрошенных игроков сейчас в Бафии */
  online = new Set<string>();

  private timeout: number;

  constructor(private options: BafiaLinkOptions) {
    super();
    this.timeout = options.timeout ?? 3000;
    this.connection = new Connection({ url: options.url, createSocket: options.createSocket, backoff: options.backoff ?? [2000, 10000, 60000], delay: options.delay });
    this.connection.on("message", text => this.receive(text));
    this.connection.on("open", () => void this.greet());
    this.connection.on("close", () => this.drop());
  }

  start() { this.connection.connect(); }

  stop() {
    this.connection.close();
    this.drop();
    this.identity = undefined;
    this.online = new Set();
    this.emit("change");
  }

  /** «Я играю под этим ником»: сервер запоминает до разрыва связи, при переподключении повторяется само */
  identify(id: string, nick: string) {
    if(this.identity?.id == id && this.identity.nick == nick) return;
    this.identity = { id, nick };
    if(this.ready) void this.request({ t: "presence", id, nick });
  }

  private async greet() {
    const hello = await this.request({ t: "hello", key: this.options.key, version: BAFIA_PROTOCOL_VERSION });
    if(hello?.t != "ok") return;
    this.gifKey = hello.gifKey;
    this.premiumUntil = hello.premium;
    this.ready = true;
    if(this.identity) await this.request({ t: "presence", ...this.identity });
    // премиум не найден по ключу (новая установка), а код у игрока сохранён - активируем его сами
    if(!this.premiumUntil && this.savedCode) await this.redeem(this.savedCode);   // цвет после активации уходит сам
    else await this.sendColor();
    this.emit("change");
  }

  private drop() {
    this.ready = false;
    for(const resolve of this.pending.values()) resolve(undefined);
    this.pending.clear();
  }

  private receive(text: string) {
    let message: ServerMessage;
    try { message = JSON.parse(text); } catch { return; }
    if(typeof message?.n != "number") return;
    this.pending.get(message.n)?.(message);
  }

  private request(message: Record<string, unknown>, timeout = this.timeout): Promise<ServerMessage | undefined> {
    const n = ++this.counter;
    return new Promise(resolve => {
      const timer = setTimeout(() => { this.pending.delete(n); resolve(undefined); }, timeout);
      this.pending.set(n, answer => { clearTimeout(timer); this.pending.delete(n); resolve(answer); });
      try {
        this.connection.send(JSON.stringify({ n, ...message }));
      } catch {
        clearTimeout(timer);
        this.pending.delete(n);
        resolve(undefined);
      }
    });
  }

  /** сообщает серверу, кого мы видим, и спрашивает, кто из них в Бафии */
  async watch(players: SeenPlayer[]) {
    if(!this.ready || !players.length) return;
    const list = players.slice(0, BAFIA_LIMITS.players);
    void this.request({ t: "seen", players: list });
    const answer = await this.request({ t: "who", ids: list.map(player => player.id) });
    if(answer?.t != "online") return;
    const next = new Set(this.online), premium = new Set(this.premiumOnline), colors = new Map(this.premiumColors);
    for(const { id } of list) {
      answer.ids.includes(id) ? next.add(id) : next.delete(id);
      answer.premium?.includes(id) ? premium.add(id) : premium.delete(id);
      const color = answer.colors?.[id];
      isPremiumColor(color) ? colors.set(id, color) : colors.delete(id);
    }
    this.online = next;
    this.premiumOnline = premium;
    this.premiumColors = colors;
    this.emit("change");
  }

  private gifCache = new Map<string, Promise<GifItem | null | undefined>>();

  /** гифка по номеру: `null` - нет в каталоге, `undefined` - сервер недоступен */
  gif(id: string): Promise<GifItem | null | undefined> {
    const cached = this.gifCache.get(id);
    if(cached) return cached;
    const asking = this.request({ t: "gif", id }).then((answer): GifItem | null | undefined => {
      if(answer?.t != "gif") return undefined;
      // даже если сервер пришлёт чужую ссылку, браузер её не откроет
      return (answer.url && this.accept({ id, url: answer.url, title: answer.title ?? "" })) || null;
    });
    this.gifCache.set(id, asking);
    void asking.then(result => { if(result === undefined) this.gifCache.delete(id); });
    return asking;
  }

  /** гифку можно показать: https с разрешённого сайта или файл сервера Бафии */
  private accept(item: GifItem): GifItem | undefined {
    const resolve = (url: string | undefined) => url && GIF_FILE_PATH.test(url) && this.options.fileBase ? this.options.fileBase.replace(/\/$/, "") + url : url;
    const url = resolve(item.url), thumb = resolve(item.thumb);
    const own = (value: string) => !!this.options.fileBase && value.startsWith(this.options.fileBase.replace(/\/$/, "") + "/g/");
    if(!url || !(isGifUrl(url) || own(url)) || (thumb && !(isGifUrl(thumb) || own(thumb)))) return undefined;
    return { ...item, url, thumb };
  }

  /**
   * поиск гифок: `bafia` - каталог сервера, `giphy` - Giphy
   * ключом, который выдал сервер. `undefined` - источник недоступен
   */
  async gifs(query: string, source: "bafia" | "giphy" | "mine"): Promise<GifItem[] | undefined> {
    if(!this.ready) return undefined;
    if(source == "mine") return this.mine();
    const text = query.slice(0, BAFIA_LIMITS.query);
    if(source == "giphy") return this.gifKey ? searchGiphy(this.gifKey, text, this.options.fetch) : undefined;
    const answer = await this.request({ t: "gifs", query: text });
    return answer?.t == "gifs" ? answer.items.flatMap(item => this.accept(item) ?? []) : undefined;
  }

  /** предложить свою гифку: попадёт в каталог после проверки администратором */
  async uploadGif(title: string, bytes: Uint8Array): Promise<{ ok: true } | { error: "offline" | "premium" | "too-big" | "bad-format" | "duplicate" | "quota" }> {
    if(bytes.length > BAFIA_LIMITS.gifBytes) return { error: "too-big" };
    if(!this.ready) return { error: "offline" };
    const answer = await this.request({ t: "gifUpload", title: title.slice(0, BAFIA_LIMITS.gifTitle), data: toBase64(bytes) }, 60_000);
    if(answer?.t == "ok") return { ok: true };
    const reason = answer?.t == "error" ? answer.reason : "";
    return { error: reason == "premium" || reason == "too-big" || reason == "bad-format" || reason == "duplicate" || reason == "quota" ? reason : "offline" };
  }

  /** выложить игру на 30 дней: номер для ссылки `[hist:номер]`, `undefined` если не вышло */
  async shareHistory(record: HistoryRecord): Promise<{ id: string } | { error: "offline" | "quota" | "too-big" }> {
    const data = JSON.stringify(record);
    const premium = !!this.premiumUntil && this.premiumUntil > Date.now();
    if(data.length > (premium ? BAFIA_LIMITS.premiumHistory : BAFIA_LIMITS.history)) return { error: "too-big" };
    if(!this.ready) return { error: "offline" };
    const answer = await this.request({ t: "histPut", data }, 15_000);
    if(answer?.t == "hist") return { id: answer.id };
    return { error: answer?.t == "error" && answer.reason == "quota" ? "quota" : "offline" };
  }

  /** игра по ссылке: `null` - её нет (устарела) или она повреждена, `undefined` - сервер недоступен */
  async loadHistory(id: string): Promise<HistoryRecord | null | undefined> {
    if(!this.ready) return undefined;
    const answer = await this.request({ t: "histGet", id }, 15_000);
    if(answer?.t != "hist") return undefined;
    if(!answer.data) return null;
    try {
      return sanitizeRecord(JSON.parse(answer.data)) ?? null;
    } catch {
      return null;
    }
  }

  /** активировать код премиума; `until` - до какого времени теперь действует */
  async redeem(code: string): Promise<{ until: number } | { error: "invalid" | "expired" | "devices" | "locked" | "offline" }> {
    if(!this.ready) return { error: "offline" };
    const answer = await this.request({ t: "redeem", code: code.trim() });
    if(answer?.t == "premium" && answer.until) {
      this.premiumUntil = answer.until;
      await this.sendColor();
      this.emit("change");
      return { until: answer.until };
    }
    const reason = answer?.t == "error" ? answer.reason : "";
    return { error: reason == "invalid" || reason == "expired" || reason == "devices" || reason == "locked" ? reason : "offline" };
  }

  /** сообщить серверу цвет моего значка (имеет смысл только с премиумом) */
  async sendColor() {
    if(this.ready && this.premiumUntil && isPremiumColor(this.color)) await this.request({ t: "style", color: this.color });
  }

  /** мои загрузки с состоянием проверки */
  async mine(): Promise<(GifItem & { status: "pending" | "approved" })[] | undefined> {
    if(!this.ready) return undefined;
    const answer = await this.request({ t: "mine" });
    return answer?.t == "mine" ? answer.items.flatMap(item => { const ok = this.accept(item); return ok ? [{ ...ok, status: item.status }] : []; }) : undefined;
  }

  /** сыграна партия */
  async played(won: boolean | undefined) {
    if(this.ready) await this.request({ t: "played", won });
  }

  /** история ников игрока; `undefined` - сервер недоступен */
  async nicks(id: string): Promise<NickRecord[] | undefined> {
    if(!this.ready) return undefined;
    const answer = await this.request({ t: "nicks", id });
    return answer?.t == "nicks" ? answer.names : undefined;
  }
}

export interface BafiaDeps {
  settings: { data: { bafia: { enabled: boolean, asked: boolean, key: string, code: string, color: string } }, on(event: "change", listener: () => void): unknown, update(change: (data: { bafia: { enabled: boolean, asked: boolean, key: string, code: string, color: string } }) => void): unknown }
  user: { playerObjectId: string, username: string, on(event: "change", listener: () => void): unknown }
  url: string
  createSocket?: BafiaLinkOptions["createSocket"]
  timeout?: number
}

/** случайный ключ установки (hex), не связан с аккаунтом, нужен серверу для различения клиентов */
export function newKey(): string {
  return [...crypto.getRandomValues(new Uint8Array(24))].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

/** сервер Бафии для окна игры: включается согласием в настройках */
export class Bafia extends Events<{ change: () => void }> {
  private link?: BafiaLink;
  private lastWatch = { signature: "", at: 0 };

  constructor(private deps: BafiaDeps) {
    super();
    deps.settings.on("change", () => this.sync());
    deps.user.on("change", () => this.sync());
    this.sync();
  }

  get enabled() { return this.deps.settings.data.bafia.enabled; }
  get online(): ReadonlySet<string> { return this.link?.online ?? new Set(); }

  get ready() { return this.link?.isReady ?? false; }
  /** до какого времени действует премиум (мс); `undefined` - нет */
  get premiumUntil() { const until = this.link?.premiumUntil; return until && until > Date.now() ? until : undefined; }
  get premiumOnline(): ReadonlySet<string> { return this.link?.premiumOnline ?? new Set(); }
  get code() { return this.deps.settings.data.bafia.code; }
  get color() { return this.deps.settings.data.bafia.color; }
  /** цвет значка игрока из Бафии с премиумом (CSS); `undefined` - нет премиума или он не в Бафии */
  premiumColor(id: string): string | undefined {
    if(!this.link?.premiumOnline.has(id)) return undefined;
    const name = this.link.premiumColors.get(id);
    return PREMIUM_COLORS[isPremiumColor(name) ? name : "gold"];
  }

  /** выбрать цвет своего значка; уходит на сервер сразу */
  setColor(color: string) {
    if(!isPremiumColor(color)) return;
    this.deps.settings.update(data => { data.bafia.color = color; });
    if(this.link) { this.link.color = color; void this.link.sendColor(); }
  }
  get asked() { return this.deps.settings.data.bafia.asked; }

  /** согласие или отказ: после ответа окно при заходе больше не показывается */
  setEnabled(enabled: boolean) {
    this.deps.settings.update(data => {
      data.bafia.enabled = enabled;
      data.bafia.asked = true;
      if(enabled && !data.bafia.key) data.bafia.key = newKey();
    });
  }

  private wasEnabled = false;

  private sync() {
    const { enabled, key } = this.deps.settings.data.bafia;
    // экраны следят за этим событием: гифки показываются или прячутся сразу после переключения
    if(enabled != this.wasEnabled) { this.wasEnabled = enabled; queueMicrotask(() => this.emit("change")); }
    if(!enabled || !key) {
      if(this.link) { this.link.stop(); this.link = undefined; this.emit("change"); }
      return;
    }
    if(!this.link) {
      const link = this.link = new BafiaLink({ url: this.deps.url, fileBase: this.deps.url.replace(/^ws/, "http"), key, createSocket: this.deps.createSocket, timeout: this.deps.timeout });
      link.savedCode = this.deps.settings.data.bafia.code || undefined;
      link.color = this.deps.settings.data.bafia.color;
      link.on("change", () => this.emit("change"));
      link.start();
    }
    const { playerObjectId, username } = this.deps.user;
    if(playerObjectId && username) this.link.identify(playerObjectId, username);
  }

  /** видимые игроки: отправляем не чаще раза в 10 секунд, узнаём, кто в Бафии */
  watch(players: { id?: string, nick: string }[]) {
    const list = players.filter((player): player is SeenPlayer => !!player.id && !!player.nick);
    const signature = list.map(player => player.id + ":" + player.nick).join("|");
    const now = Date.now();
    if(!this.link || (signature == this.lastWatch.signature && now - this.lastWatch.at < 10_000)) return;
    this.lastWatch = { signature, at: now };
    void this.link.watch(list);
  }

  /** ввести код премиума; при успехе код запоминается */
  async redeem(code: string) {
    const result = await (this.link?.redeem(code) ?? Promise.resolve({ error: "offline" } as const));
    if("until" in result) this.deps.settings.update(data => { data.bafia.code = code.trim().toUpperCase(); });
    return result;
  }

  gif(id: string) { return this.link?.gif(id) ?? Promise.resolve(undefined); }
  gifs(query: string, source: "bafia" | "giphy" | "mine") { return this.link?.gifs(query, source) ?? Promise.resolve(undefined); }
  uploadGif(title: string, bytes: Uint8Array) { return this.link?.uploadGif(title, bytes) ?? Promise.resolve({ error: "offline" } as const); }

  shareHistory(record: HistoryRecord) { return this.link?.shareHistory(record) ?? Promise.resolve({ error: "offline" } as const); }
  loadHistory(id: string) { return this.link?.loadHistory(id) ?? Promise.resolve(undefined); }

  played(won: boolean | undefined) { void this.link?.played(won); }

  nicks(id: string) { return this.link?.nicks(id) ?? Promise.resolve(undefined); }

  dispose() { this.link?.stop(); this.link = undefined; }
}

/** что уходит на сервер Бафии: показывается при первом заходе и при включении в настройках */
export const BAFIA_CONSENT =
  "Бафия может отправлять данные на свой сервер:\n" +
  "• твой ник и публичный id игрока;\n" +
  "• ники и id игроков, которых ты видишь в комнатах и чатах;\n" +
  "• сколько партий ты сыграл и выиграл;\n" +
  "• случайный ключ этой установки (с аккаунтом игры не связан).\n\n" +
  "Не отправляются: почта, пароль, токен и сообщения. Сервер не записывает IP-адреса.\n\n" +
  "Взамен ты увидишь, кто из игроков тоже играет в Бафии, историю ников и гифки в сообщениях других игроков Бафии. " +
  "Без согласия гифки не показываются. Изменить выбор можно в настройках.";
