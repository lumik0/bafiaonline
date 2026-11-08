import { sanitizeRecord, sharedForm, type HistoryRecord } from "./history";
import { versionNumber } from "@common/version";
import { detectBrowser, detectPlatform, detectSite } from "./platform";
import { isPremiumColor, nickKey, USAGE_KEY, PREMIUM_COLORS, AVATAR_FILE_PATH, BANNER_FILE_PATH, PROFILE_BG, parseLook, type ProfileLook, BAFIA_LIMITS, BAFIA_PROTOCOL_VERSION, GIF_FILE_PATH, GIF_ID, giphyIdOf, giphyUrl, isGifUrl, type Browser, type FeedbackItem, type FeedbackKind, type GifItem, type NickRecord, type Platform, type SeenPlayer, type ServerMessage } from "@common/bafia/protocol";
import type { SocketLike } from "@common/net/connection";
import { Connection } from "@common/net/connection";
import Events from "@common/utils/emitter";
import { toBase64 } from "@common/assets/pack";
import { log } from "@common/logger";
import { searchGiphy } from "./giphy";
import { GifCache } from "./gif-cache";

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
  /** сколько ждать связи между попытками отправить отчёт о краше, мс (по умолчанию 500) */
  crashWait?: number
  /** проверка связи раз в `interval` мс; нет ответа за `timeout` мс два раза подряд - переподключаемся (по умолчанию 30 и 5 секунд) */
  heartbeat?: { interval?: number, timeout?: number }
}

/**
 * связь с сервером Бафии; при ошибке или молчании просто пустой результат
 * уходят только ник, публичный id, случайный ключ установки и счётчики партий
 */
export const feedbackProblems: Record<FeedbackError, string> = {
  empty: "Напиши текст",
  "too-long": `Не длиннее ${BAFIA_LIMITS.feedback} символов`,
  offline: "Сервер Бафии сейчас недоступен. Попробуй позже.",
  "slow-down": "Не так быстро: подожди немного перед следующей отправкой.",
  quota: "На сегодня достаточно: за сутки можно отправить ограниченное число сообщений.",
  "presence-first": "Сервер Бафии ещё не узнал тебя: подожди пару секунд и повтори.",
  "bad-request": "Сообщение не принято. Попробуй обновить игру."
};

export type FeedbackError = "empty" | "too-long" | "offline" | "slow-down" | "quota" | "presence-first" | "bad-request";

/** на какое сообщение администратора можно ответить: сообщение всем (`notice`) или личное (`direct`) */
export interface ReplyTarget { notice?: number, direct?: number }

export class BafiaLink extends Events<{ change: () => void, notice: (text: string, reply?: ReplyTarget) => void, premium: (code?: string) => void }> {
  private connection: Connection;
  private pending = new Map<number, (message: ServerMessage | undefined) => void>();
  private counter = 0;
  private identity?: SeenPlayer & { platform?: Platform, version?: string, browser?: Browser, site?: string };
  /** до какого времени (мс) действует премиум на этой установке */
  premiumUntil?: number;
  /** игроки из последних ответов «кто в Бафии», у которых премиум */
  premiumOnline = new Set<string>();
  /** цвета их значков (название из PREMIUM_COLORS) */
  premiumColors = new Map<string, string>();
  /** пути аватарок игроков из последних ответов «кто в Бафии» (id → `/a/номер`) */
  avatars = new Map<string, string>();
  /** путь моей аватарки; нет - аватарки нет */
  myAvatar?: string;
  /** баннеры и цвета фона профиля игроков с премиумом из последних ответов «кто в Бафии» */
  banners = new Map<string, string>();
  backs = new Map<string, string>();
  /** мои баннер и цвет фона профиля */
  myBanner?: string;
  myBg?: string;
  /** внешний вид профилей игроков с премиумом (статус, рамка, эффект, тема, гифка) и мой */
  looks = new Map<string, ProfileLook>();
  myLook: ProfileLook = {};
  /** мой выбранный цвет: отправляется серверу, когда есть премиум */
  color?: string;
  /** код, который активируется сам при подключении, если премиума ещё нет */
  savedCode?: string;
  private ready = false;
  /** ключ Giphy, который выдал сервер: без него поиск идёт только по каталогу сервера */
  private gifKey?: string;
  get isReady() { return this.ready; }
  /** сколько попыток подключиться подряд не удалось (с последнего успеха) */
  attempts = 0;
  /** почему сервер не принял: ответ на hello (`version`, `too-many`…) или `no-answer`; пусто - всё хорошо или ещё не отвечал */
  problem?: string;
  /** подключено, подключаемся или связи нет (попытки не удались или сервер не принял) */
  get state(): "connected" | "connecting" | "offline" { return this.ready ? "connected" : this.attempts > 0 || this.problem ? "offline" : "connecting"; }
  /** кто из спрошенных игроков сейчас в Бафии */
  online = new Set<string>();

  private timeout: number;

  constructor(private options: BafiaLinkOptions) {
    super();
    this.timeout = options.timeout ?? 3000;
    this.connection = new Connection({ url: options.url, createSocket: options.createSocket, backoff: options.backoff ?? [2000, 10000, 60000], delay: options.delay });
    this.connection.on("message", text => this.receive(text));
    this.connection.on("open", () => void this.greet());
    this.connection.on("close", willReconnect => {
      this.drop();
      if(willReconnect) {
        this.attempts++;
        // в журнал (его присылают с отчётами) - не каждую попытку, а первую и дальше реже
        if([1, 3, 10, 30, 100].includes(this.attempts)) log("warn", `Бафия: нет связи с сервером, неудачных попыток подряд: ${this.attempts}`);
      }
      this.emit("change");
    });
  }

  start() { this.connection.connect(); }

  private beatTimer?: ReturnType<typeof setInterval>;
  private missed = 0;

  /** раз в полминуты спрашиваем сервер; два молчания подряд - связь тихо умерла, подключаемся заново */
  private startHeartbeat() {
    this.stopHeartbeat();
    const { interval = 30_000, timeout = 5_000 } = this.options.heartbeat ?? {};
    this.beatTimer = setInterval(() => void this.beat(timeout), interval);
  }

  private stopHeartbeat() {
    if(this.beatTimer) clearInterval(this.beatTimer);
    this.beatTimer = undefined;
    this.missed = 0;
  }

  private async beat(timeout: number) {
    if(!this.ready) return;
    if(await this.request({ t: "ping" }, timeout)) { this.missed = 0; return; }
    // за время ожидания связь могла оборваться и вернуться сама
    if(!this.ready) return;
    if(++this.missed >= 2) { this.missed = 0; this.connection.reset(); }
  }

  stop() {
    this.stopHeartbeat();
    this.connection.close();
    this.drop();
    this.attempts = 0;
    this.problem = undefined;
    this.identity = undefined;
    this.online = new Set();
    this.emit("change");
  }

  private banReport?: { id: string, nick: string, until: number };

  /** игра не пустила этого игрока (бан): сервер Бафии покажет всем значок «БАН» до конца срока. При входе без бана значок снимается сам */
  reportBan(id: string, nick: string, seconds: number) {
    this.banReport = { id, nick, until: Date.now() + seconds * 1000 };
    // игрок не играет: старое «я играю» при переподключении сняло бы значок
    this.identity = undefined;
    if(this.ready) void this.request({ t: "banned", id, nick, seconds });
  }

  /** «Я играю под этим ником»: сервер запоминает до разрыва связи, при переподключении повторяется само */
  identify(id: string, nick: string, platform?: Platform, version?: string, browser?: Browser, site?: string) {
    const old = this.identity;
    if(old?.id == id && old.nick == nick && old.platform == platform && old.version == version && old.browser == browser && old.site == site) return;
    this.identity = { id, nick, platform, version, browser, site };
    if(this.ready) void this.request({ t: "presence", id, nick, platform, version, browser, site });
  }

  private async greet() {
    const hello = await this.request({ t: "hello", key: this.options.key, version: BAFIA_PROTOCOL_VERSION });
    if(hello?.t != "ok") {
      this.problem = hello?.t == "error" ? hello.reason : "no-answer";
      log("warn", `Бафия: сервер не принял подключение (${this.problem})`);
      this.emit("change");
      return;
    }
    if(this.attempts || this.problem) log("info", "Бафия: связь с сервером восстановлена");
    this.attempts = 0;
    this.problem = undefined;
    this.gifKey = hello.gifKey;
    this.premiumUntil = hello.premium;
    this.myAvatar = hello.avatar;
    this.myBanner = typeof hello.banner == "string" && BANNER_FILE_PATH.test(hello.banner) ? hello.banner : undefined;
    this.myBg = PROFILE_BG.test(hello.profileBg ?? "") ? hello.profileBg : undefined;
    this.myLook = parseLook(hello.look);
    this.ready = true;
    this.startHeartbeat();
    if(this.identity) await this.request({ t: "presence", ...this.identity });
    else if(this.banReport) {
      // после переподключения шлём остаток срока, а не исходный: иначе значок каждый раз продлевался бы
      const { id, nick, until } = this.banReport, seconds = Math.ceil((until - Date.now()) / 1000);
      if(seconds > 0) await this.request({ t: "banned", id, nick, seconds });
      else this.banReport = undefined;
    }
    // премиум не найден по ключу (новая установка), а код у игрока сохранён - активируем его сами
    if(!this.premiumUntil && this.savedCode) await this.redeem(this.savedCode);   // цвет после активации уходит сам
    else await this.sendColor();
    this.emit("change");
  }

  /** сообщение администратора: только настоящее (непустой текст нужной длины) */
  private announce(text: unknown, id?: unknown, direct?: unknown) {
    const valid = (value: unknown) => typeof value == "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
    if(typeof text == "string" && text.length > 0 && text.length <= BAFIA_LIMITS.notice) {
      const reply: ReplyTarget = valid(direct) !== undefined ? { direct: valid(direct) } : valid(id) !== undefined ? { notice: valid(id) } : {};
      this.emit("notice", text, "notice" in reply || "direct" in reply ? reply : undefined);
    }
  }

  private grantedPremium(until: unknown, code: unknown) {
    if(typeof until != "number" || !Number.isFinite(until) || until <= Date.now()) return;
    this.premiumUntil = until;
    this.emit("premium", typeof code == "string" && /^[A-Za-z0-9-]{6,32}$/.test(code) ? code.toUpperCase() : undefined);
    this.emit("change");
    void this.sendColor();
  }

  private drop() {
    this.stopHeartbeat();
    this.ready = false;
    for(const resolve of this.pending.values()) resolve(undefined);
    this.pending.clear();
  }

  private receive(text: string) {
    let message: ServerMessage;
    try { message = JSON.parse(text); } catch { return; }
    if(typeof message?.n != "number") return;
    // сообщение администратора приходит само, без запроса
    if(message.t == "notice") return this.announce(message.text, message.id, message.direct);
    // премиум пришёл без запроса: включается на лету, код запоминается, чтобы вернуться и на новой установке
    if(message.t == "premium" && message.n === 0) return this.grantedPremium(message.until, message.code);
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

  /** спрашивает, кто из видимых игроков в Бафии; ники этих игроков уходят серверу (история ников) только при `shareSeen` */
  async watch(players: SeenPlayer[], shareSeen = true) {
    if(!this.ready || !players.length) return;
    const list = players.slice(0, BAFIA_LIMITS.players);
    if(shareSeen) void this.request({ t: "seen", players: list });
    const answer = await this.request({ t: "who", ids: list.map(player => player.id) });
    if(answer?.t != "online") return;
    const next = new Set(this.online), premium = new Set(this.premiumOnline), colors = new Map(this.premiumColors), avatars = new Map(this.avatars), banners = new Map(this.banners), backs = new Map(this.backs), looks = new Map(this.looks);
    for(const { id } of list) {
      answer.ids.includes(id) ? next.add(id) : next.delete(id);
      answer.premium?.includes(id) ? premium.add(id) : premium.delete(id);
      const color = answer.colors?.[id];
      isPremiumColor(color) ? colors.set(id, color) : colors.delete(id);
      const avatar = answer.avatars?.[id];
      typeof avatar == "string" && AVATAR_FILE_PATH.test(avatar) ? avatars.set(id, avatar) : avatars.delete(id);
      const banner = answer.banners?.[id], back = answer.backs?.[id];
      typeof banner == "string" && BANNER_FILE_PATH.test(banner) ? banners.set(id, banner) : banners.delete(id);
      typeof back == "string" && PROFILE_BG.test(back) ? backs.set(id, back) : backs.delete(id);
      const look = parseLook(answer.looks?.[id]);
      Object.keys(look).length ? looks.set(id, look) : looks.delete(id);
    }
    this.online = next;
    this.premiumOnline = premium;
    this.premiumColors = colors;
    this.avatars = avatars;
    this.banners = banners;
    this.backs = backs;
    this.looks = looks;
    this.emit("change");
  }

  /** очки «Позора» у ников, которым положен значок (ключ - `nickKey`) */
  shameMarks = new Map<string, number>();
  /** до какого времени (мс) у ника бан (ключ - `nickKey`) */
  banMarks = new Map<string, number>();

  /**
   * значки «Позор» и «БАН» для этих ников (игроки могут быть и не в сети: друзья, чат, профиль). Ответ сервера заменяет
   * известное об этих никах: кого сняли или разбанили, у того значок пропадает
   */
  async marks(nicks: string[]) {
    const list = [...new Set(nicks.filter(Boolean))].slice(0, BAFIA_LIMITS.players);
    if(!this.ready || !list.length) return;
    const answer = await this.request({ t: "marks", nicks: list });
    if(answer?.t != "marks") return;
    const shame = new Map(this.shameMarks), bans = new Map(this.banMarks);
    for(const nick of list) {
      const key = nickKey(nick), points = answer.shame?.[key], until = answer.bans?.[key];
      typeof points == "number" && points > 0 ? shame.set(key, points) : shame.delete(key);
      typeof until == "number" && Number.isFinite(until) ? bans.set(key, until) : bans.delete(key);
    }
    this.shameMarks = shame;
    this.banMarks = bans;
    this.emit("change");
  }

  private gifCache = new Map<string, Promise<GifItem | null | undefined>>();

  /** гифка по номеру: `null` - нет в каталоге, `undefined` - сервер недоступен */
  gif(id: string): Promise<GifItem | null | undefined> {
    const cached = this.gifCache.get(id);
    if(cached) return cached;
    // гифка Giphy: адрес известен по номеру, сервер спрашивать незачем; берём лёгкую версию 200 px: в чате больше не показывается
    const giphyId = giphyIdOf(id);
    if(giphyId) {
      const local = Promise.resolve(this.accept({ id, url: giphyUrl(giphyId, "200w"), title: "" }) ?? null);
      this.gifCache.set(id, local);
      return local;
    }
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

  /** предложить свою гифку: у премиума сразу в каталоге, у остальных после проверки администратором */
  async uploadGif(title: string, bytes: Uint8Array): Promise<{ ok: true, approved: boolean } | { error: "offline" | "premium" | "too-big" | "bad-format" | "duplicate" | "quota" | "slow-down" | "full" | "presence-first" }> {
    if(bytes.length > BAFIA_LIMITS.gifBytes) return { error: "too-big" };
    if(!this.ready) return { error: "offline" };
    const answer = await this.request({ t: "gifUpload", title: title.slice(0, BAFIA_LIMITS.gifTitle), data: toBase64(bytes) }, 60_000);
    if(answer?.t == "ok") return { ok: true, approved: !!answer.approved };
    const reason = answer?.t == "error" ? answer.reason : "";
    return { error: reason == "premium" || reason == "too-big" || reason == "bad-format" || reason == "duplicate" || reason == "quota" || reason == "slow-down" || reason == "full" || reason == "presence-first" ? reason : "offline" };
  }

  /** пачка счётчиков «что открывали» (только названия экранов и функций, без текстов); `true` - принято сервером */
  async sendUsage(counts: Record<string, number>): Promise<boolean> {
    if(!this.ready) return false;
    return (await this.request({ t: "usage", counts }))?.t == "ok";
  }

  /** сколько я в Бафии: время, дней и с какого дня считается; `undefined` - нет связи или сервер ещё не знает меня */
  async myStats(): Promise<{ seconds: number, days: number, since?: string } | undefined> {
    if(!this.ready) return undefined;
    const answer = await this.request({ t: "myStats" });
    return answer?.t == "myStats" ? { seconds: answer.seconds, days: answer.days, since: answer.since } : undefined;
  }

  /** мои обращения (идеи, баги, предложения) и что с ними стало; `undefined` - нет связи */
  async myFeedback(): Promise<FeedbackItem[] | undefined> {
    if(!this.ready) return undefined;
    const answer = await this.request({ t: "myFeedback" });
    return answer?.t == "myFeedback" && Array.isArray(answer.items) ? answer.items : undefined;
  }

  /** отчёт о краше: уходит сам, без согласия (в нём нет ни сообщений, ни трафика); связи могло ещё не быть, поэтому ждём её до пяти секунд */
  async sendCrash(text: string): Promise<boolean> {
    if(!text.trim() || text.length > BAFIA_LIMITS.crash) return false;
    for(let wait = 0; !this.ready && wait < 10; wait++) await new Promise(resolve => setTimeout(resolve, this.options.crashWait ?? 500));
    if(!this.ready) return false;
    return (await this.request({ t: "crash", text }, 15_000))?.t == "ok";
  }

  /** отправить администратору идею, баг, предложение или ответ на его сообщение (`reply` - на какое) */
  async sendFeedback(kind: FeedbackKind, text: string, reply?: ReplyTarget): Promise<{ ok: true } | { error: FeedbackError }> {
    const body = text.trim();
    if(!body) return { error: "empty" };
    if(body.length > BAFIA_LIMITS.feedback) return { error: "too-long" };
    if(!this.ready) return { error: "offline" };
    const answer = await this.request({ t: "feedback", kind, text: body, ...(reply?.notice !== undefined ? { notice: reply.notice } : {}), ...(reply?.direct !== undefined ? { direct: reply.direct } : {}) });
    if(answer?.t == "ok") return { ok: true };
    const reason = answer?.t == "error" ? answer.reason : "";
    return { error: reason == "slow-down" || reason == "quota" || reason == "presence-first" || reason == "bad-request" ? reason : "offline" };
  }

  /** выложить игру на 30 дней: номер для ссылки `[hist:номер]`, `undefined` если не вышло */
  async shareHistory(record: HistoryRecord): Promise<{ id: string } | { error: "offline" | "quota" | "too-big" }> {
    // привязка к аккаунту на этом устройстве другим не нужна
    const data = JSON.stringify(sharedForm(record));
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

  /** поставить свою аватарку (gif, webp или png до 1 МБ); другие игроки Бафии увидят её сразу */
  async setAvatar(bytes: Uint8Array): Promise<{ ok: true } | { error: "offline" | "premium" | "too-big" | "bad-format" | "quota" | "full" | "presence-first" }> {
    if(bytes.length > BAFIA_LIMITS.avatarBytes) return { error: "too-big" };
    if(!this.ready) return { error: "offline" };
    const answer = await this.request({ t: "avatarSet", data: toBase64(bytes) }, 30_000);
    if(answer?.t == "ok") {
      this.myAvatar = typeof answer.avatar == "string" && AVATAR_FILE_PATH.test(answer.avatar) ? answer.avatar : undefined;
      this.emit("change");
      return { ok: true };
    }
    const reason = answer?.t == "error" ? answer.reason : "";
    return { error: reason == "premium" || reason == "too-big" || reason == "bad-format" || reason == "quota" || reason == "full" || reason == "presence-first" ? reason : "offline" };
  }

  /** поставить баннер профиля (только премиум): gif, webp или png */
  async setBanner(bytes: Uint8Array): Promise<{ ok: true } | { error: "offline" | "premium" | "too-big" | "bad-format" | "quota" | "full" | "presence-first" }> {
    if(bytes.length > BAFIA_LIMITS.bannerBytes) return { error: "too-big" };
    if(!this.ready) return { error: "offline" };
    const answer = await this.request({ t: "bannerSet", data: toBase64(bytes) }, 30_000);
    if(answer?.t == "ok") {
      this.myBanner = typeof answer.banner == "string" && BANNER_FILE_PATH.test(answer.banner) ? answer.banner : undefined;
      this.emit("change");
      return { ok: true };
    }
    const reason = answer?.t == "error" ? answer.reason : "";
    return { error: reason == "premium" || reason == "too-big" || reason == "bad-format" || reason == "quota" || reason == "full" || reason == "presence-first" ? reason : "offline" };
  }

  async clearBanner(): Promise<boolean> {
    if(!this.ready) return false;
    const answer = await this.request({ t: "bannerClear" });
    if(answer?.t != "ok") return false;
    this.myBanner = undefined;
    this.emit("change");
    return true;
  }

  /** внешний вид профиля (только премиум): статус, рамка, эффект, тема, закреплённая гифка; заменяет прежний целиком */
  async setLook(look: ProfileLook): Promise<"ok" | "premium" | "offline"> {
    if(!this.ready) return "offline";
    const answer = await this.request({ t: "look", look });
    if(answer?.t == "ok") {
      this.myLook = parseLook(answer.look);
      this.emit("change");
      return "ok";
    }
    return answer?.t == "error" && answer.reason == "premium" ? "premium" : "offline";
  }

  /** жалоба на баннер или аватарку игрока, который сейчас в сети */
  async report(id: string, kind: "banner" | "avatar"): Promise<"ok" | "nothing" | "self" | "slow-down" | "offline"> {
    if(!this.ready) return "offline";
    const answer = await this.request({ t: "report", id, kind });
    if(answer?.t == "ok") return "ok";
    const reason = answer?.t == "error" ? answer.reason : "";
    return reason == "nothing" || reason == "self" || reason == "slow-down" ? reason : "offline";
  }

  /** кто из этих ников сейчас в Бафии (ключи `nickKey`); `undefined` - нет связи */
  async nicksOnline(nicks: string[]): Promise<Set<string> | undefined> {
    if(!this.ready || !nicks.length) return undefined;
    const answer = await this.request({ t: "whoNicks", nicks: nicks.slice(0, 20) });
    return answer?.t == "onlineNicks" ? new Set(answer.nicks) : undefined;
  }

  /** цвет фона профиля (`#rrggbb`) или пусто, чтобы убрать; только премиум */
  async setProfileBg(color: string): Promise<"ok" | "premium" | "offline"> {
    if(!this.ready) return "offline";
    const answer = await this.request({ t: "profileBg", color });
    if(answer?.t == "ok") {
      this.myBg = color || undefined;
      this.emit("change");
      return "ok";
    }
    return answer?.t == "error" && answer.reason == "premium" ? "premium" : "offline";
  }

  /** убрать свою аватарку */
  async clearAvatar(): Promise<boolean> {
    if(!this.ready) return false;
    const answer = await this.request({ t: "avatarClear" });
    if(answer?.t != "ok") return false;
    this.myAvatar = undefined;
    this.emit("change");
    return true;
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

/** избранная гифка: номер (`g_…` из Giphy или номер каталога Бафии) и название для поиска */
export interface FavoriteGif { id: string, title: string }
/** сколько гифок можно хранить в избранном */
export const FAVORITES_MAX = 200;

export interface BafiaSettings { enabled: boolean, asked: boolean, key: string, code: string, color: string, favorites: FavoriteGif[], watched?: string[], expiryWarned?: number, feedbackSeen?: Record<string, string> }

export interface BafiaDeps {
  settings: { data: { bafia: BafiaSettings, lowPower?: boolean }, on(event: "change", listener: () => void): unknown, update(change: (data: { bafia: BafiaSettings }) => void): unknown }
  user: { playerObjectId: string, username: string, on(event: "change", listener: () => void): unknown }
  url: string
  createSocket?: BafiaLinkOptions["createSocket"]
  timeout?: number
  /** с какого устройства играем; по умолчанию определяется по браузеру */
  platform?: Platform
  /** браузер и адрес сайта для статистики; по умолчанию определяются сами */
  browser?: Browser
  site?: string
  /** версия игры, уходит в статистику; по умолчанию текущая */
  version?: string
  /** через сколько мс накопленные счётчики «что открывали» уходят на сервер (по умолчанию минута) */
  usageDelay?: number
}

/** случайный ключ установки (hex), не связан с аккаунтом, нужен серверу для различения клиентов */
export function newKey(): string {
  return [...crypto.getRandomValues(new Uint8Array(24))].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * сервер Бафии для окна игры. Всегда работает «кто играет» и значок премиума (твой ник и id, число партий, id видимых игроков),
 * остальное (ники других игроков, гифки, игры, аватарки) - только с согласием в настройках
 */
export class Bafia extends Events<{ change: () => void, notice: (text: string, reply?: ReplyTarget) => void }> {
  private link?: BafiaLink;
  /** гифки из сообщений: скачиваются сразу, живут в памяти 5 минут */
  readonly images = new GifCache();
  private lastWatch = { signature: "", at: 0 };

  constructor(private deps: BafiaDeps) {
    super();
    deps.settings.on("change", () => this.sync());
    deps.user.on("change", () => this.sync());
    this.sync();
    this.startWatchPoll();
  }

  /** согласие на всё остальное: гифки, история ников, игры, аватарки */
  get enabled() { return this.deps.settings.data.bafia.enabled; }
  get online(): ReadonlySet<string> { return this.link?.online ?? new Set(); }

  get ready() { return this.link?.isReady ?? false; }
  /** состояние связи с сервером Бафии для настроек: игрок видит, подключено ли у него, и в чём дело, если нет */
  get status(): { state: "connected" | "connecting" | "offline", attempts: number, problem?: string } {
    return { state: this.link?.state ?? "connecting", attempts: this.link?.attempts ?? 0, problem: this.link?.problem };
  }
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

  /** адрес аватарки игрока (файл сервера Бафии); `undefined` - аватарки нет или сервер не включён. `small` - статичное превью */
  avatar(id: string, small = false): string | undefined {
    const link = this.consented;
    if(!link) return undefined;
    const mine = id == this.deps.user.playerObjectId;
    // аватарка - перк премиума: без него её не видно, но на сервере она остаётся
    const path = mine ? (link.premiumUntil && link.premiumUntil > Date.now() ? link.myAvatar : undefined) : link.avatars.get(id);
    // small - маленькое статичное превью для чата и списков: десятки анимированных аватарок сразу лагают на телефоне
    // при экономии ресурсов анимации не крутятся нигде: везде статичное превью
    return path && AVATAR_FILE_PATH.test(path) ? this.deps.url.replace(/^ws/, "http").replace(/\/$/, "") + path + (small || this.deps.settings.data.lowPower ? "/t" : "") : undefined;
  }
  /** адрес баннера профиля игрока; свой виден только пока есть премиум */
  banner(id: string): string | undefined {
    const link = this.consented;
    if(!link) return undefined;
    const mine = id == this.deps.user.playerObjectId;
    const path = mine ? (link.premiumUntil && link.premiumUntil > Date.now() ? link.myBanner : undefined) : link.banners.get(id);
    return path && BANNER_FILE_PATH.test(path) ? this.deps.url.replace(/^ws/, "http").replace(/\/$/, "") + path : undefined;
  }
  /** цвет фона профиля игрока (`#rrggbb`) */
  profileBg(id: string): string | undefined {
    const link = this.consented;
    if(!link) return undefined;
    const mine = id == this.deps.user.playerObjectId;
    return mine ? (link.premiumUntil && link.premiumUntil > Date.now() ? link.myBg : undefined) : link.backs.get(id);
  }
  /** внешний вид профиля игрока; свой виден только пока есть премиум */
  look(id: string): ProfileLook {
    const link = this.consented;
    if(!link) return {};
    const mine = id == this.deps.user.playerObjectId;
    return mine ? (link.premiumUntil && link.premiumUntil > Date.now() ? link.myLook : {}) : link.looks.get(id) ?? {};
  }
  get myLook(): ProfileLook { return this.look(this.deps.user.playerObjectId); }
  setLook(look: ProfileLook) { return this.consented?.setLook(look) ?? Promise.resolve("offline" as const); }
  report(id: string, kind: "banner" | "avatar") { return this.consented?.report(id, kind) ?? Promise.resolve("offline" as const); }

  /** избранные игроки (ники): когда зайдут в Бафию, приходит уведомление */
  get watched(): readonly string[] {
    const list = this.deps.settings.data.bafia.watched;
    return Array.isArray(list) ? list.filter(nick => typeof nick == "string") : [];
  }
  isWatched(nick: string) { return this.watched.some(item => nickKey(item) == nickKey(nick)); }
  toggleWatched(nick: string): boolean {
    const had = this.isWatched(nick);
    this.deps.settings.update(data => {
      const rest = this.watched.filter(item => nickKey(item) != nickKey(nick));
      data.bafia.watched = had ? rest : [nick, ...rest].slice(0, 20);
    });
    this.emit("change");
    return !had;
  }
  private watchedOnline = new Set<string>();
  private watchTimer?: ReturnType<typeof setInterval>;
  /** раз в минуту спрашивает сервер об избранных игроках и сообщает о тех, кто только что зашёл */
  private pollWatched = async () => {
    if(!this.enabled || !this.watched.length) { this.watchedOnline = new Set(); return; }
    const now = await this.consented?.nicksOnline([...this.watched]);
    if(!now) return;
    // первый ответ только запоминаем: при запуске игры никого «только что зашедшим» считать не нужно
    const first = this.watchedOnline.size == 0 && !this.polled;
    this.polled = true;
    if(!first) for(const nick of this.watched) if(now.has(nickKey(nick)) && !this.watchedOnline.has(nickKey(nick))) this.emit("notice", `${nick} в Бафии`);
    this.watchedOnline = now;
  };
  private polled = false;
  /** запускает опрос избранных игроков; вызывается один раз при создании */
  private startWatchPoll() {
    this.watchTimer = setInterval(() => void this.pollWatched(), 60_000);
  }
  /** если премиум закончится в ближайшие 3 дня, напоминает раз в сутки */
  private warnExpiry() {
    const until = this.premiumUntil;
    if(!until || until - Date.now() > 3 * 86_400_000) return;
    const today = Math.floor(Date.now() / 86_400_000);
    if(this.deps.settings.data.bafia.expiryWarned == today) return;
    this.deps.settings.update(data => { data.bafia.expiryWarned = today; });
    const days = Math.max(1, Math.ceil((until - Date.now()) / 86_400_000));
    this.emit("notice", `Премиум Бафии закончится через ${days} дн. Продлить можно в настройках, во вкладке «Бафия»`);
  }
  get myBannerUrl() { return this.banner(this.deps.user.playerObjectId); }
  get myProfileBg() { return this.profileBg(this.deps.user.playerObjectId); }
  get myAvatarUrl() { return this.avatar(this.deps.user.playerObjectId); }

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
    // ключ нужен всегда: «кто играет» работает без согласия; сохранение ключа вызывает sync ещё раз
    if(!key) return void this.deps.settings.update(data => { if(!data.bafia.key) data.bafia.key = newKey(); });
    if(!this.link) {
      const link = this.link = new BafiaLink({ url: this.deps.url, fileBase: this.deps.url.replace(/^ws/, "http"), key, createSocket: this.deps.createSocket, timeout: this.deps.timeout });
      link.savedCode = this.deps.settings.data.bafia.code || undefined;
      link.color = this.deps.settings.data.bafia.color;
      link.on("change", () => {
        this.scheduleExpiry(); this.warnExpiry(); this.emit("change");
        // связь появилась: список обращений подтягиваем один раз
        if(link.isReady && !this.feedbackLoaded) { this.feedbackLoaded = true; void this.refreshFeedback(); }
      });
      // одноразовое сообщение администратора: игра показывает его баннером
      link.on("notice", (text, reply) => this.emit("notice", text, reply));
      link.on("premium", code => { if(code) this.deps.settings.update(data => { data.bafia.code = code; }); });
      link.start();
    }
    const { playerObjectId, username } = this.deps.user;
    if(playerObjectId && username) this.link.identify(playerObjectId, username, this.deps.platform ?? detectPlatform(), this.deps.version ?? versionNumber, this.deps.browser ?? detectBrowser(), this.deps.site ?? detectSite());
  }

  /** официальный сервер не пустил игрока (бан): сообщаем серверу Бафии; игрок ещё не вошёл, поэтому ник и id берутся из сохранённого аккаунта */
  reportBan(id: string, nick: string, seconds: number) {
    this.sync();
    this.link?.reportBan(id, nick, seconds);
  }

  /** видимые игроки: отправляем не чаще раза в 10 секунд, узнаём, кто в Бафии */
  watch(players: { id?: string, nick: string }[]) {
    const list = players.filter((player): player is SeenPlayer => !!player.id && !!player.nick);
    const signature = list.map(player => player.id + ":" + player.nick).join("|");
    const now = Date.now();
    if(!this.link || (signature == this.lastWatch.signature && now - this.lastWatch.at < 10_000)) return;
    this.lastWatch = { signature, at: now };
    void this.link.watch(list, this.enabled);
    if(this.enabled) void this.link.marks(list.map(player => player.nick));
  }

  private lastMarks = { signature: "", at: 0 };

  /** значки «Позор» и «БАН» по никам (друзья, рейтинг и другие списки без id игроков); не чаще раза в полминуты для одного набора */
  watchNicks(nicks: string[]) {
    const list = [...new Set(nicks.filter(Boolean))];
    const signature = list.join("|");
    const now = Date.now();
    if(!this.link || !this.enabled || !list.length || (signature == this.lastMarks.signature && now - this.lastMarks.at < 30_000)) return;
    this.lastMarks = { signature, at: now };
    void this.link.marks(list);
  }

  /** очки «Позора» у игрока, если ему положен значок (с согласия на сервер Бафии) */
  shamePoints(nick: string): number | undefined {
    return this.consented?.shameMarks.get(nickKey(nick));
  }

  /** до какого времени бан у игрока; нет бана или срок вышел - `undefined`. Срок проверяется по времени устройства, чтобы значок пропал вовремя */
  banUntil(nick: string): number | undefined {
    const until = this.consented?.banMarks.get(nickKey(nick));
    return until !== undefined && until > Date.now() ? until : undefined;
  }

  private expiryTimer?: ReturnType<typeof setTimeout>;
  private expiryAt = 0;

  /** когда закончится ближайший бан, экраны получают событие: значок «БАН» пропадает сам, без нового запроса */
  private scheduleExpiry() {
    const now = Date.now();
    const next = Math.min(Infinity, ...[...(this.link?.banMarks.values() ?? [])].filter(until => until > now));
    if(next == this.expiryAt) return;
    clearTimeout(this.expiryTimer);
    this.expiryAt = next;
    if(next == Infinity) return;
    // setTimeout не принимает больше ~24 суток; дольше ждать и не нужно: по «change» срок пересчитается
    this.expiryTimer = setTimeout(() => { this.expiryAt = 0; this.emit("change"); this.scheduleExpiry(); }, Math.min(next - now + 300, 2 ** 31 - 1));
  }

  /** ввести код премиума; при успехе код запоминается */
  async redeem(code: string) {
    const result = await (this.link?.redeem(code) ?? Promise.resolve({ error: "offline" } as const));
    if("until" in result) { this.deps.settings.update(data => { data.bafia.code = code.trim().toUpperCase(); }); this.track("feature:redeem"); }
    return result;
  }

  // дальше всё только с согласием: без него сервер ничего не спрашиваем и не отправляем
  private get consented() { return this.enabled ? this.link : undefined; }
  gif(id: string) { return this.consented?.gif(id) ?? Promise.resolve(undefined); }
  gifs(query: string, source: "bafia" | "giphy" | "mine" | "favorites") {
    return source == "favorites" ? this.favoriteItems(query) : this.consented?.gifs(query, source) ?? Promise.resolve(undefined);
  }

  /** избранные гифки (новые первыми); лишнего в сохранённых данных не бывает: битые записи отбрасываются */
  get favorites(): readonly FavoriteGif[] {
    const list = this.deps.settings.data.bafia.favorites;
    return Array.isArray(list) ? list.filter(item => typeof item?.id == "string" && GIF_ID.test(item.id) && typeof item.title == "string") : [];
  }
  isFavorite(id: string) { return this.favorites.some(item => item.id == id); }

  /** добавить в избранное или убрать; возвращает, в избранном ли гифка теперь */
  toggleFavorite(id: string, title = ""): boolean {
    if(!GIF_ID.test(id)) return false;
    const had = this.isFavorite(id);
    this.deps.settings.update(data => {
      const rest = this.favorites.filter(item => item.id != id);
      data.bafia.favorites = had ? rest : [{ id, title: title.slice(0, BAFIA_LIMITS.gifTitle) }, ...rest].slice(0, FAVORITES_MAX);
    });
    this.emit("change");
    return !had;
  }

  /** избранное как обычный список гифок: адреса берутся из каталога, по названию можно искать; исчезнувшие из каталога пропускаются */
  private async favoriteItems(query: string): Promise<GifItem[] | undefined> {
    if(!this.enabled) return undefined;
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const list = this.favorites.filter(item => words.every(word => item.title.toLowerCase().includes(word)));
    const found = await Promise.all(list.map(async item => {
      const gif = await this.gif(item.id);
      return gif ? { ...gif, title: gif.title || item.title } : undefined;
    }));
    const items = found.flatMap(gif => gif ? [gif] : []);
    // сервер каталога ещё недоступен, а показать нечего: пусть панель повторит запрос, когда связь появится
    return !items.length && list.length && !this.ready ? undefined : items;
  }
  async setAvatar(bytes: Uint8Array) { const result = await (this.consented?.setAvatar(bytes) ?? Promise.resolve({ error: "offline" } as const)); if("ok" in result) this.track("feature:avatarSet"); return result; }
  clearAvatar() { return this.consented?.clearAvatar() ?? Promise.resolve(false); }
  setBanner(bytes: Uint8Array) { return this.consented?.setBanner(bytes) ?? Promise.resolve({ error: "offline" } as const); }
  clearBanner() { return this.consented?.clearBanner() ?? Promise.resolve(false); }
  setProfileBg(color: string) { return this.consented?.setProfileBg(color) ?? Promise.resolve("offline" as const); }
  /** отчёт о краше игры (см. BafiaLink.sendCrash): связь поднимается, даже если игрок ещё не вошёл */
  reportCrash(text: string): Promise<boolean> {
    this.sync();
    return this.link?.sendCrash(text) ?? Promise.resolve(false);
  }

  // --- что открывают и чем пользуются ---

  private usage: Record<string, number> = {};
  private usageTimer?: ReturnType<typeof setTimeout>;

  /** запоминает «открыт экран» или «нажата функция» (`screen:menu`, `feature:rehost`); раз в минуту уходит пачкой, только названия и счётчики */
  track(key: string) {
    if(!USAGE_KEY.test(key)) return;
    this.usage[key] = Math.min(1000, (this.usage[key] ?? 0) + 1);
    if(Object.keys(this.usage).length >= 40) return void this.flushUsage();
    this.usageTimer ??= setTimeout(() => void this.flushUsage(), this.deps.usageDelay ?? 60_000);
  }

  /** отправляет накопленное; не вышло (нет связи) - остаётся до следующего раза */
  async flushUsage(): Promise<void> {
    clearTimeout(this.usageTimer);
    this.usageTimer = undefined;
    const counts = this.usage;
    if(!Object.keys(counts).length) return;
    this.usage = {};
    if(await (this.link?.sendUsage(counts) ?? Promise.resolve(false))) return;
    for(const [key, count] of Object.entries(counts)) this.usage[key] = Math.min(1000, (this.usage[key] ?? 0) + count);
    this.usageTimer ??= setTimeout(() => void this.flushUsage(), (this.deps.usageDelay ?? 60_000) * 5);
  }

  /** время в Бафии для своего профиля (по моему нику, без согласия: свои данные); `undefined` - нет связи */
  myStats() { return this.link?.myStats() ?? Promise.resolve(undefined); }

  // --- мои обращения ---

  private feedbackItems: FeedbackItem[] = [];
  private feedbackLoaded = false;

  get feedback(): readonly FeedbackItem[] { return this.feedbackItems; }

  /** сколько обращений получили ответ или разобраны, а игрок ещё этого не видел: значок на кнопке «Идеи и баги» */
  get feedbackNews(): number {
    const seen = this.deps.settings.data.bafia.feedbackSeen ?? {};
    return this.feedbackItems.filter(item => item.status != "sent" && seen[String(item.id)] != item.status).length;
  }

  /** обновляет список обращений с сервера; без связи остаётся прежний */
  async refreshFeedback(): Promise<readonly FeedbackItem[]> {
    const items = await this.link?.myFeedback();
    if(items) { this.feedbackItems = items; this.emit("change"); }
    return this.feedbackItems;
  }

  /** игрок открыл экран: все статусы, которые сейчас есть, считаются увиденными */
  markFeedbackSeen() {
    this.deps.settings.update(data => { const seen = data.bafia.feedbackSeen ??= {}; for(const item of this.feedbackItems) seen[String(item.id)] = item.status; });
    this.emit("change");
  }

  /** идеи и ответы - осознанное действие игрока, согласие на «гифки и историю ников» для них не нужно (уходят только текст и ник) */
  async sendFeedback(kind: FeedbackKind, text: string, reply?: ReplyTarget) {
    const result = await (this.link?.sendFeedback(kind, text, reply) ?? Promise.resolve({ error: "offline" } as const));
    if("ok" in result) { this.track(kind == "reply" ? "feature:reply" : "feature:feedbackSend"); if(kind != "reply") void this.refreshFeedback(); }
    return result;
  }
  async uploadGif(title: string, bytes: Uint8Array) { const result = await (this.consented?.uploadGif(title, bytes) ?? Promise.resolve({ error: "offline" } as const)); if("ok" in result) this.track("feature:gifUpload"); return result; }

  async shareHistory(record: HistoryRecord) { const result = await (this.consented?.shareHistory(record) ?? Promise.resolve({ error: "offline" } as const)); if("id" in result) this.track("feature:historyShare"); return result; }
  loadHistory(id: string) { return this.consented?.loadHistory(id) ?? Promise.resolve(undefined); }

  played(won: boolean | undefined) { void this.link?.played(won); }

  nicks(id: string) { return this.consented?.nicks(id) ?? Promise.resolve(undefined); }

  dispose() { clearInterval(this.watchTimer); clearTimeout(this.expiryTimer); clearTimeout(this.usageTimer); this.expiryAt = 0; this.link?.stop(); this.link = undefined; this.images.clear(); }
}

/** что уходит на сервер Бафии: показывается при первом заходе и при включении в настройках */
export const BAFIA_CONSENT =
  "Всегда, чтобы было видно, кто играет в Бафии, и значок премиума:\n" +
  "• твой ник и публичный id игрока;\n" +
  "• с какого устройства ты играешь (iOS, Android, Windows, macOS, Linux или другое), в каком браузере (Chrome, Safari и так далее) и с какого сайта открыта игра, без моделей, версий и путей;\n" +
  "• сколько партий ты сыграл и выиграл и сколько времени провёл в Бафии;\n" +
  "• если игра не пустила тебя при входе (бан), твой ник и сколько осталось, чтобы у других был виден значок «БАН»;\n" +
  "• id игроков, которых ты видишь (без ников), чтобы узнать, кто из них в Бафии;\n" +
  "• если игра крашнулась, отчёт об ошибке: текст ошибки, версия игры, экран, грубое устройство и журнал без трафика и сообщений;\n" +
  "• какие экраны и функции игры ты открываешь: только их названия и счётчики, без текстов и ников;\n" +
  "• случайный ключ этой установки (с аккаунтом игры не связан).\n\n" +
  "Если согласишься, то ещё:\n" +
  "• ники игроков, которых ты видишь: для истории ников и значков «Позор» и «БАН» у нарушителей;\n" +
  "• гифки и стикеры, отправка игр из истории, аватарки игроков.\n\n" +
  "Не отправляются никогда: почта, пароль, токен и сообщения. Сервер не записывает IP-адреса.\n\n" +
  "Без согласия гифки, история ников и аватарки не работают и не показываются. Изменить выбор можно в настройках.";
