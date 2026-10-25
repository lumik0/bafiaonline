import { ConnectionError, Connection, RequestTimeoutError, ServerClient, type SocketLike } from "@common/net";
import { Bafia, BAFIA_CONSENT } from "./domain/bafia";
import { MessageAlerts } from "./domain/message-alerts";
import { animationSource } from "./ui/animation-source";
import { BAFIA_SERVER_URL, SERVER_URLS } from "@common/constants";
import { log } from "@common/logger";
import { describeCrash, normalizeError, type CrashInfo } from "@common/panic";
import { createSignal, mount } from "@common/ui";
import { createDialogs, DialogManager } from "@common/ui/dialog/dialogs";
import { Navigator, type Screens } from "@common/ui/nav/navigator";
import type { GameHost } from "@launcher/game";
import type { GameContext } from "./context";
import { Auth, signInProblem } from "./domain/auth";
import { Friends } from "./domain/friends";
import type { WorkerLike } from "@mods/index";
import { ConnectionMonitor } from "./domain/connection-monitor";
import { enterRoom } from "./domain/rooms/enter";
import type { RoomSession } from "./domain/room/session";
import { isMobile } from "@common/utils/mobile";
import { ModManager } from "./mods/manager";
import { officialMod } from "./mods/official";
import { bindBrowserBack } from "./ui/browser-back";
import { rehostRoom } from "./domain/rooms/rehost";
import { waitAndJoin } from "./ui/room-actions";
import { ModsScreen } from "./screens/ModsScreen.tsrx";
import { ShopScreen } from "./screens/ShopScreen.tsrx";
import { RatingsScreen } from "./screens/RatingsScreen.tsrx";
import { RulesScreen } from "./screens/RulesScreen.tsrx";
import { BackpackScreen } from "./screens/BackpackScreen.tsrx";
import { CompetitiveScreen } from "./screens/CompetitiveScreen.tsrx";
import { historyDocument } from "./domain/history";
import { filterDocument } from "./domain/rooms/filter";
import { RoomsList } from "./domain/rooms/rooms";
import { DocumentStore } from "./domain/store";
import { ProfileService, usernameProblems } from "./domain/profile";
import { SettingsStore } from "./domain/settings";
import { User } from "./domain/user";
import type { Routes } from "./routes";
import { Authorization } from "./screens/Authorization.tsrx";
import { connectionText, type ConnectionStage } from "./domain/loading";
import { Loading } from "./screens/Loading.tsrx";
import { FriendsScreen } from "./screens/FriendsScreen.tsrx";
import { GlobalChatScreen } from "./screens/GlobalChatScreen.tsrx";
import { Menu } from "./screens/Menu.tsrx";
import type { MenuActions } from "./screens/menu-actions";
import { RoomCreationScreen } from "./screens/RoomCreationScreen.tsrx";
import { HistoryScreen } from "./screens/HistoryScreen.tsrx";
import { RoomScreen } from "./screens/RoomScreen.tsrx";
import { RoomsScreen } from "./screens/RoomsScreen.tsrx";
import { PrivateChatScreen } from "./screens/PrivateChatScreen.tsrx";
import { Profile } from "./screens/Profile.tsrx";
import { Settings } from "./screens/Settings.tsrx";
import { ThemePage } from "./screens/ThemePage.tsrx";
import { PhotoPicker } from "./ui/dialogs/PhotoPicker.tsrx";
import { GameRoot } from "./ui/GameRoot.tsrx";

export interface StartOptions {
  url?: string
  createSocket?: (url: string) => SocketLike
  /** сервер Бафии (необязательный): адрес и сокет - для тестов */
  bafiaUrl?: string
  createBafiaSocket?: (url: string) => SocketLike
  /** воркеры модов; по умолчанию настоящие Web Worker (в тестах подставляется заглушка) */
  spawnWorker?: (source: string) => WorkerLike
  /** через сколько мс без связи сказать об этом игроку */
  slowConnectionAfter?: number
  /** через сколько мс без связи сказать, что сервер не отвечает и ждать зря не стоит */
  serverDownAfter?: number
}

export interface GameInstance {
  ctx: GameContext
  /** закрывает соединение и убирает экраны (вызывается при закрытии окна) */
  dispose(): void
}

/** запуск игры в окне лаунчера: соединение, вход, навигация по экранам */
export async function startGame(host: GameHost, options: StartOptions = {}): Promise<GameInstance> {
  const client = new ServerClient(new Connection({ url: options.url ?? SERVER_URLS, createSocket: options.createSocket }));
  const user = new User();
  const auth = new Auth(client, host.storage.accounts, user);
  const nav = new Navigator<Routes>();
  const dialogs = createDialogs(new DialogManager());
  const settings = await SettingsStore.load(host.storage.settings);
  const roomFilter = await DocumentStore.load(filterDocument(host.storage.files));
  const history = await DocumentStore.load(historyDocument(host.storage.files));
  const [loadingText, setLoadingText] = createSignal("Подключение…");
  const [serverDown, setServerDown] = createSignal(false);
  const [crash, setCrash] = createSignal<CrashInfo | undefined>(undefined);
  const mods = new ModManager({
    client, files: host.storage.files, theme: host.theme, user, nav,
    builtIn: [officialMod], spawn: options.spawnWorker,
    notify: options => host.notifications.show(options),
    alert: (title, text) => dialogs.alert(text, { title }),
    actions: {
      enterRoom: id => {
        const room = ctx.rooms.get(id);
        if(!room) throw new Error("Этой комнаты нет в списке");
        return enterRoom(ctx, id, room.hasPassword);
      },
      waitAndJoin: id => waitAndJoin(ctx, id),
      rehostRoom: session => rehostRoom(ctx, session),
      openProfile: id => ctx.openProfile(id)
    }
  });
  let asking = false;
  const askBafia = async() => {
    if(asking || ctx.bafia.asked || true || !user.playerObjectId || !user.username) return;
    asking = true;
    ctx.bafia.setEnabled(await dialogs.confirm(BAFIA_CONSENT, { title: "СЕРВЕР БАФИИ", yes: "Согласен", no: "Не согласен" }));
  };
  user.on("change", () => void askBafia());
  animationSource.read = path => host.assets.readText(path);
  const ctx: GameContext = {
    host, client, auth, user, nav, dialogs, settings, mods,
    bafia: new Bafia({ settings, user, url: options.bafiaUrl ?? BAFIA_SERVER_URL, createSocket: options.createBafiaSocket }),
    profile: new ProfileService(client, user, host.storage.accounts),
    friends: new Friends(client),
    rooms: new RoomsList(client),
    roomFilter, history,
    assets: host.assets, theme: host.theme,
    crash,
    panic: (error, description) => {
      if(crash()) return;
      const normalized = normalizeError(error);
      log("error", "КРАХ:", normalized.stack);
      console.error(error);
      // связь больше не нужна, окна поверх экрана закрываем: остаётся только отчёт
      client.close();
      dialogs.manager.closeAll();
      setCrash({ error: normalized, description: describeCrash(normalized, description), screen: nav.top?.name ?? "unknown" });
    },
    back: async() => {
      if(!nav.canGoBack) return;
      if(ctx.backGuard && !await ctx.backGuard()) return;
      nav.pop();
    },
    openProfile: playerObjectId => {
      if(playerObjectId) void dialogs.manager.open({ title: "ПРОФИЛЬ", width: 500, render: close => Profile({ ctx, playerObjectId, close }) });
    }
  };

  // пакет известного типа не подошёл к схеме: в журнале остаётся целиком, чтобы схему можно было поправить
  client.on("malformed", (text, error) => log("warn", "ПАКЕТ НЕ ПОДОШЁЛ", String(error), text.slice(0, 3000)));
  client.on("traffic", ({ direction, name, data }) => log("info", direction == "in" ? "←" : "→", name, data));

  /** новому аккаунту ник нужен, чтобы играть: спрашиваем, пока сервер не примет */
  async function ensureUsername() {
    while(!user.username) {
      const value = await dialogs.prompt({
        title: "НИКНЕЙМ", required: true, placeholder: "Никнейм",
        text: "Для игры и общения с другими игроками нужен никнейм.\n3–12 символов: цифры и буквы",
        validate: value => value.trim().length < 3 || value.trim().length > 12 ? "От 3 до 12 символов" : undefined
      });
      if(value === undefined) continue;
      const result = await ctx.profile.setUsername(value.trim());
      if(result.status != "ok") await dialogs.alert(usernameProblems[result.status]);
    }
  }

  async function signIn(email: string, password: string): Promise<string | undefined> {
    try {
      const problem = signInProblem(await auth.signIn({ email, password }));
      if(!problem) {
        nav.reset("menu");
        void ensureUsername();
      }
      return problem;
    } catch(error) {
      if(error instanceof ConnectionError || error instanceof RequestTimeoutError) return "Нет связи с сервером. Попробуй ещё раз";
      return error instanceof Error ? error.message : String(error);
    }
  }

  const actions: MenuActions = {
    rooms: () => nav.push("rooms"), competitive: () => nav.push("competitive"), chat: () => nav.push("globalChat"), friends: () => nav.push("friends"),
    history: () => nav.push("history"),
    backpack: () => nav.push("backpack"), ratings: () => nav.push("ratings"), rules: () => nav.push("rules"), shop: () => nav.push("shop"),
    settings: () => nav.push("settings"),
    profile: () => ctx.openProfile(user.playerObjectId),
    changePhoto: () => void dialogs.manager.open({ title: "ФОТО ПРОФИЛЯ", render: close => PhotoPicker({ ctx, close }) }),
    telegram: () => void window.open("https://t.me/bafiaonline", "_blank", "noopener")
  };

  const screens: Screens<Routes> = {
    loading: () => Loading({ text: loadingText, assets: host.assets, down: serverDown }),
    authorization: ({ params }) => Authorization({ email: params.email, error: params.error, submit: signIn }),
    menu: () => Menu({ user, assets: host.assets, settings, actions }),
    settings: () => Settings({ ctx }),
    theme: () => ThemePage({ ctx }),
    friends: () => FriendsScreen({ ctx }),
    globalChat: () => GlobalChatScreen({ ctx }),
    rooms: () => RoomsScreen({ ctx }),
    history: () => HistoryScreen({ ctx }),
    backpack: () => BackpackScreen({ ctx }),
    rules: () => RulesScreen({ ctx }),
    ratings: () => RatingsScreen({ ctx }),
    shop: () => ShopScreen({ ctx }),
    mods: () => ModsScreen({ ctx }),
    competitive: () => CompetitiveScreen({ ctx }),
    roomCreation: () => RoomCreationScreen({ ctx }),
    room: ({ params }) => RoomScreen({ ctx, session: params.session }),
    privateChat: ({ params }) => PrivateChatScreen({ ctx, ...params })
  };

  await mods.start();
  nav.push("loading");
  const disposeUi = mount(() => GameRoot({ ctx, screens }) as never, host.window.content);

  // на телефоне системная кнопка «назад» ходит по экранам игры, а не закрывает вкладку
  const unbindBack = isMobile() ? bindBrowserBack(ctx) : undefined;

  // личные сообщения и заявки в друзья: баннер, если игрок не в личном чате
  const alerts = new MessageAlerts({ client, user, notifier: host.notifications, chatOpen: () => nav.top?.name == "privateChat", canPoll: () => nav.top?.name == "menu", requestsOutsideMenu: () => settings.data.game.pollRequests });
  alerts.start();
  // вернулись в меню: значки заявок и сообщений обновляем сразу, а не ждём таймера
  nav.on("change", transition => { if(transition.to.name == "menu") void alerts.poll(); });

  // связь пропала, интернета нет, сервер молчит - игрок должен это видеть, а не смотреть на замерший таймер
  const monitor = new ConnectionMonitor({
    client, notifier: host.notifications, network: window,
    inGame: () => {
      const session = nav.top?.name == "room" ? (nav.top.params as { session?: RoomSession }).session : undefined;
      // после конца игры (статус 4) таймер не идёт: тишина не означает обрыв
      return !!session && !session.replay && session.state.status == 3;
    }
  });
  monitor.start();

  // связь вернулась в игре: садимся за стол заново, подписку на дашборд не трогаем
  const activeSession = () => {
    const session = nav.top?.name == "room" ? (nav.top.params as { session?: RoomSession }).session : undefined;
    return session && !session.replay && session.state.status != 4 ? session : undefined;
  };
  auth.keepSubscription = () => !!activeSession();
  auth.on("signedIn", (_account, reconnected) => { if(reconnected) activeSession()?.rejoin(); });

  user.on("change", () => { if(user.username) host.window.setTitle(`Бафия - ${user.username}`); });

  // что видит игрок без связи: «Подключение…», потом «не удаётся», потом «сервер не отвечает»
  let failedAttempts = 0;
  let stage: ConnectionStage = "connecting";
  const showConnection = () => {
    if(nav.top?.name == "loading") setLoadingText(connectionText(stage, failedAttempts, navigator.onLine !== false));
  };
  client.on("close", willReconnect => {
    if(!willReconnect || nav.top?.name != "loading") return;
    failedAttempts++;
    if(stage != "connecting") showConnection();
  });
  const advance = (next: ConnectionStage) => () => { stage = next; setServerDown(next == "down"); showConnection(); };
  const slow = setTimeout(advance("slow"), options.slowConnectionAfter ?? 8000);
  const down = setTimeout(advance("down"), options.serverDownAfter ?? 25_000);

  // await client.wait("open", 30_000);

  client.once("open", async() => {
    clearTimeout(slow);
    clearTimeout(down);
    stage = "connecting";
    setServerDown(false);
    failedAttempts = 0;
    const { account } = host;
    if(account?.email && account.password) {
      setLoadingText("Вход…");
      const problem = await signIn(account.email, account.password);
      if(problem) nav.replace("authorization", { email: account.email, error: problem });
    } else {
      nav.replace("authorization", { email: account?.email });
    }
  });

  const dispose = () => {
    clearTimeout(slow);
    clearTimeout(down);
    dialogs.manager.closeAll();
    disposeUi();
    void settings.flush();
    void roomFilter.flush();
    void history.flush();
    mods.stop();
    ctx.bafia.dispose();
    alerts.stop();
    unbindBack?.();
    monitor.stop();
    client.close();
    client.removeAllListeners();
  };
  host.window.on("close", dispose);
  client.connect();

  return { ctx, dispose };
}
