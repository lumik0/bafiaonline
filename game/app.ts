import { bafiaRoomProblems, openBafiaRoom } from "./domain/rooms/bafia-open";
import { ConnectionError, Connection, RequestTimeoutError, ServerClient, type SocketLike } from "@common/net";
import { Bafia, BAFIA_CONSENT, feedbackProblems } from "./domain/bafia";
import { MessageAlerts } from "./domain/message-alerts";
import { animationSource, setAnimationsOff } from "./ui/animation-source";
import { BAFIA_SERVER_URL, SERVER_URLS } from "@common/constants";
import { versionNumber } from "@common/version";
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
import { ForegroundWatch } from "./domain/foreground";
import { enterRoom, openRoom } from "./domain/rooms/enter";
import { inviteFromSearch } from "./domain/invite";
import type { RoomSession } from "./domain/room/session";
import { isMobile } from "@common/utils/mobile";
import { ModManager } from "./mods/manager";
import { officialMod } from "./mods/official";
import { bindBrowserBack } from "./ui/browser-back";
import { bindNativeBack } from "./ui/native-back";
import { isNativeApp } from "@common/utils/native";
import { rehostListed, rehostRoom } from "./domain/rooms/rehost";
import { resetPassword } from "./ui/reset-password";
import { waitAndJoin } from "./ui/room-actions";
import { ModsScreen } from "./screens/ModsScreen.tsrx";
import { ShopScreen } from "./screens/ShopScreen.tsrx";
import { FeedbackScreen } from "./screens/FeedbackScreen.tsrx";
import { RatingsScreen } from "./screens/RatingsScreen.tsrx";
import { RulesScreen } from "./screens/RulesScreen.tsrx";
import { BackpackScreen } from "./screens/BackpackScreen.tsrx";
import { CompetitiveScreen } from "./screens/CompetitiveScreen.tsrx";
import { historyDocument } from "./domain/history";
import { filterDocument } from "./domain/rooms/filter";
import { joinProblems, RoomsList } from "./domain/rooms/rooms";
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
  /** адрес списка проверенных модов; по умолчанию - сервер Бафии (в тестах и со своим сервером Бафии не запрашивается) */
  modRegistryUrl?: string
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

/** адрес из ?server=ws://... для проверки с поддельным сервером; только свой компьютер или локальная сеть, чужой сервер получил бы пароль */
function serverOverride(): string | undefined {
  if(typeof location == "undefined") return undefined;
  const value = new URLSearchParams(location.search).get("server");
  if(!value) return undefined;
  try {
    const { protocol, hostname } = new URL(value);
    const local = hostname == "localhost" || /^(127|10)\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
    return (protocol == "ws:" || protocol == "wss:") && local ? value : undefined;
  } catch {
    return undefined;
  }
}

/** адрес сервера Бафии из ?bafia=ws://... для разработки: только свой компьютер или локальная сеть (там идут комнаты, статистика, гифки) */
function bafiaOverride(): string | undefined {
  if(typeof location == "undefined") return undefined;
  const value = new URLSearchParams(location.search).get("bafia");
  if(!value) return undefined;
  try {
    const { protocol, hostname } = new URL(value);
    const local = hostname == "localhost" || /^(127|10)\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
    return (protocol == "ws:" || protocol == "wss:") && local ? value : undefined;
  } catch {
    return undefined;
  }
}

/** запуск игры в окне лаунчера: соединение, вход, навигация по экранам */
export async function startGame(host: GameHost, options: StartOptions = {}): Promise<GameInstance> {
  const bafiaUrl = options.bafiaUrl ?? bafiaOverride() ?? BAFIA_SERVER_URL;
  const client = new ServerClient(new Connection({ url: options.url ?? serverOverride() ?? SERVER_URLS, createSocket: options.createSocket }));
  const user = new User();
  const auth = new Auth(client, host.storage.accounts, user);
  // игрока не пустили в игру (бан): сервер Бафии показывает значок «БАН», пока он не закончится; ник и id берём из сохранённого аккаунта
  auth.on("blocked", (email, seconds) => {
    void host.storage.accounts.list().then(accounts => {
      const account = accounts.find(item => item.email == email);
      if(account?.name && account.playerUserId) ctx.bafia.reportBan(account.playerUserId, account.name, seconds);
    }).catch(() => {});
  });
  const nav = new Navigator<Routes>();
  // перезаход после обрыва не удался (например, бан): показываем причину на экране входа
  auth.on("restoreFailed", (email, result) => {
    dialogs.manager.closeAll();
    nav.replace("authorization", { email, error: signInProblem(result) });
  });
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
    registryUrl: options.modRegistryUrl ?? (options.bafiaUrl ? undefined : bafiaUrl.replace(/^ws/, "http") + "/mods/registry.json"),
    submitMod: pack => ctx.bafia.submitMod(pack),
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
      rehostListed: async id => {
        const room = ctx.rooms.get(id);
        if(!room) throw new Error("Этой комнаты нет в списке");
        await rehostListed(ctx, room);
      },
      openProfile: id => ctx.openProfile(id)
    }
  });
  let asking = false;
  const askBafia = async() => {
    if(asking || ctx.bafia.asked || !user.playerObjectId || !user.username) return;
    asking = true;
    ctx.bafia.setEnabled(await dialogs.confirm(BAFIA_CONSENT, { title: "СЕРВЕР БАФИИ", yes: "Согласен", no: "Не согласен" }));
  };
  user.on("change", () => void askBafia());
  animationSource.read = path => host.assets.readText(path);
  // экономия ресурсов (или «уменьшить движение» в системе): анимации украшений, праздничные эффекты и статичные превью аватарок
  const reduceMotion = () => typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const applyLowPower = () => {
    setAnimationsOff(settings.data.lowPower || reduceMotion());
    host.theme.setQuiet(settings.data.lowPower);
  };
  applyLowPower();
  settings.on("change", applyLowPower);
  const ctx: GameContext = {
    host, client, auth, user, nav, dialogs, settings, mods,
    bafia: new Bafia({ settings, user, url: bafiaUrl, createSocket: options.createBafiaSocket }),
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

  // ссылка-приглашение: адрес вида ?room=номер, после входа заходим в комнату; из адреса номер убираем, чтобы обновление страницы не повторяло вход
  let invite = inviteFromSearch(location.search);
  if(invite) { const params = new URLSearchParams(location.search); params.delete("room"); window.history.replaceState(null, "", location.pathname + ([...params].length ? "?" + params : "") + location.hash); }
  async function openInvite() {
    const roomId = invite;
    invite = undefined;
    if(!roomId) return;
    ctx.bafia.track("feature:inviteOpen");
    try {
      const result = await ctx.rooms.join(roomId, "");
      if(result.status == "ok") openRoom(ctx, result, { fallbackId: roomId });
      else if(result.status == "wrongPassword") await enterRoom(ctx, roomId, true);
      else await dialogs.alert(joinProblems[result.status], { title: "Ссылка-приглашение" });
    } catch {
      await dialogs.alert("Не получилось зайти по ссылке: сервер не ответил или комнаты уже нет.", { title: "Ссылка-приглашение" });
    }
  }

  async function signIn(email: string, password: string): Promise<string | undefined> {
    try {
      const problem = signInProblem(await auth.signIn({ email, password }));
      // вход прошёл: официальный сервер отвечает (если до этого сообщали, что нет, или так сказано другим, говорим, что всё работает)
      if(!problem) ctx.bafia.reportOfficial(true);
      if(!problem) {
        nav.reset("menu");
        void ensureUsername().then(openInvite);
      }
      return problem;
    } catch(error) {
      if(error instanceof ConnectionError || error instanceof RequestTimeoutError) {
        // соединение есть, а ответа на вход нет: сообщаем серверу Бафии, пусть остальные не ждут зря
        ctx.bafia.reportOfficial(false);
        return "Нет связи с сервером. Попробуй ещё раз";
      }
      return error instanceof Error ? error.message : String(error);
    }
  }

  const actions: MenuActions = {
    rooms: () => nav.push("rooms"), competitive: () => nav.push("competitive"), chat: () => nav.push("globalChat"), friends: () => nav.push("friends"),
    history: () => nav.push("history"),
    backpack: () => nav.push("backpack"), ratings: () => nav.push("ratings"), feedback: () => nav.push("feedback"), rules: () => nav.push("rules"), shop: () => nav.push("shop"),
    settings: () => nav.push("settings"),
    profile: () => ctx.openProfile(user.playerObjectId),
    changePhoto: () => void dialogs.manager.open({ title: "ФОТО ПРОФИЛЯ", render: close => PhotoPicker({ ctx, close }) }),
    telegram: () => void window.open("https://t.me/bafiaonline", "_blank", "noopener")
  };

  const screens: Screens<Routes> = {
    loading: () => Loading({ text: loadingText, assets: host.assets, down: serverDown }),
    authorization: ({ params }) => Authorization({ email: params.email, error: params.error, submit: signIn, forgot: (email: string) => void resetPassword(ctx, email) }),
    menu: () => Menu({ user, assets: host.assets, settings, actions, bafia: ctx.bafia }),
    settings: () => Settings({ ctx }),
    theme: () => ThemePage({ ctx }),
    friends: () => FriendsScreen({ ctx }),
    globalChat: () => GlobalChatScreen({ ctx }),
    rooms: () => RoomsScreen({ ctx }),
    history: () => HistoryScreen({ ctx }),
    backpack: () => BackpackScreen({ ctx }),
    rules: () => RulesScreen({ ctx }),
    ratings: () => RatingsScreen({ ctx }),
    feedback: () => FeedbackScreen({ ctx }),
    shop: () => ShopScreen({ ctx }),
    mods: () => ModsScreen({ ctx }),
    competitive: () => CompetitiveScreen({ ctx }),
    roomCreation: () => RoomCreationScreen({ ctx }),
    bafiaRoomCreation: () => RoomCreationScreen({ ctx, bafia: true }),
    room: ({ params }) => RoomScreen({ ctx, session: params.session }),
    privateChat: ({ params }) => PrivateChatScreen({ ctx, ...params })
  };

  await mods.start();
  nav.push("loading");
  // просим браузер не вычищать данные игры (история, настройки) при нехватке места и долгом простое; ответ не важен
  void navigator.storage?.persist?.().catch(() => {});

  const disposeUi = mount(() => GameRoot({ ctx, screens }) as never, host.window.content);

  // на телефоне системная кнопка «назад» ходит по экранам игры, а не закрывает вкладку
  // в приложении кнопка «назад» своя (закрывает и окно игры), в браузере - через историю
  const unbindBack = isNativeApp() ? bindNativeBack(ctx) : isMobile() ? bindBrowserBack(ctx) : undefined;

  // личные сообщения и заявки в друзья: баннер, если игрок не в личном чате
  // сообщение от администратора (например, «вышла новая версия, обнови страницу»): баннер, который не мешает игре
  // на сообщение администратора можно ответить кнопкой «Ответить» (как в macOS)
  // личное сообщение (от администратора только тебе) приходит отдельным баннером, на него тоже можно ответить
  ctx.bafia.on("notice", (text, target) => host.notifications.show({
    key: target?.direct ? "bafia-direct-" + target.direct : "bafia-notice", title: target?.direct ? "Личное сообщение от Бафии" : "Сообщение от Бафии", text, kind: "info", timeout: target?.direct ? 0 : 40_000,
    reply: target === undefined ? undefined : {
      placeholder: "Ответить",
      send: async reply => { const result = await ctx.bafia.sendFeedback("reply", reply, target); return "ok" in result ? undefined : feedbackProblems[result.error]; }
    }
  }));
  // приглашение в комнату Бафии от администратора: баннер, нажатие - сразу в комнату (во время игры не мешаем)
  ctx.bafia.on("invite", invite => {
    if(nav.top?.name == "room") return;
    host.notifications.show({
      key: "bafia-invite-" + invite.room, title: "Приглашение в комнату Бафии", text: `«${invite.title}» - нажми, чтобы зайти`, kind: "info", timeout: 60_000,
      action: async() => {
        const result = await ctx.bafia.joinRoom(invite.room, invite.password);
        if("error" in result) return void await dialogs.alert(bafiaRoomProblems[result.error] ?? "Не получилось зайти.", { title: "Комната Бафии" });
        openBafiaRoom(ctx, result.adapter);
      }
    });
  });
  const alerts = new MessageAlerts({ client, user, notifier: host.notifications, chatOpen: () => nav.top?.name == "privateChat", canPoll: () => nav.top?.name == "menu", requestsOutsideMenu: () => settings.data.game.pollRequests });
  alerts.start();
  // вернулись в меню: значки заявок и сообщений обновляем сразу, а не ждём таймера
  // вкладку закрывают или сворачивают: накопленные счётчики «что открывали» отправляем сразу
  document.addEventListener("visibilitychange", () => { if(document.visibilityState == "hidden") void ctx.bafia.flushUsage(); });
  nav.on("change", transition => { ctx.bafia.track("screen:" + transition.to.name); if(transition.to.name == "menu") void alerts.poll(); });

  // связь пропала, интернета нет, сервер молчит - игрок должен это видеть, а не смотреть на замерший таймер
  const monitor = new ConnectionMonitor({
    client, notifier: host.notifications, network: window,
    // соединение «живое», а сервер игры молчит: сообщаем серверу Бафии, он предупредит остальных, чтобы не ждали зря
    onStall: stalled => ctx.bafia.reportOfficial(!stalled),
    reconnect: () => client.connection.reset(),
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
  // вернулись на вкладку после долгого фона: сокет мог тихо умереть, поэтому открываем соединение заново, пока вне игры
  const foreground = new ForegroundWatch({ document, window, busy: () => !!activeSession(), reconnect: () => monitor.quietReconnect(() => client.connection.reset()) });
  foreground.start();
  ctx.rooms.isActive = () => nav.top?.name == "rooms";
  auth.on("signedIn", (_account, reconnected) => {
    if(!reconnected) return;
    activeSession()?.rejoin();
    // после переподключения подписка на список комнат пропала (вход загрузил дашборд): на экране списка запрашиваем его заново
    if(nav.top?.name == "rooms") ctx.rooms.refresh();
  });

  user.on("change", () => { if(user.username) host.window.setTitle(`Бафия ${versionNumber} - ${user.username}`); });

  // что видит игрок без связи: «Подключение…», потом «не удаётся», потом «сервер не отвечает»
  let failedAttempts = 0;
  let stage: ConnectionStage = "connecting";
  const showConnection = () => {
    // сервер Бафии уже знает, что официальный лежит: говорим это сразу, а не «Подключение…»
    const official = ctx.bafia.officialDown;
    if(nav.top?.name == "loading") setLoadingText(official && navigator.onLine !== false ? official.text : connectionText(stage, failedAttempts, navigator.onLine !== false));
  };
  // сообщение «Сервер Мафии временно недоступен» от сервера Бафии: плашка, пока так, и текст на экране загрузки
  ctx.bafia.on("official", () => {
    const official = ctx.bafia.officialDown;
    if(official) host.notifications.show({ key: "official-down", kind: "warning", timeout: 0, title: "Сервер Мафии недоступен", text: official.text });
    else host.notifications.show({ key: "official-down", kind: "success", timeout: 4000, title: "Сервер Мафии снова доступен", text: "Можно заходить" });
    showConnection();
  });
  client.on("close", willReconnect => {
    if(!willReconnect || nav.top?.name != "loading") return;
    failedAttempts++;
    if(stage != "connecting") showConnection();
  });
  const advance = (next: ConnectionStage) => () => { stage = next; setServerDown(next == "down"); showConnection(); if(next == "down") ctx.bafia.reportOfficial(false); };
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
    foreground.stop();
    client.close();
    client.removeAllListeners();
  };
  host.window.on("close", dispose);
  client.connect();

  return { ctx, dispose };
}
