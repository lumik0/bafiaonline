/**
 * типы для авторов модов: `import { mod } from "bafia:api"`
 * каждый метод требует разрешения из manifest.json. В tsconfig мода добавьте этот файл в "include"
 */
declare module "bafia:api" {

export type Permission =
  | "packet:send" | "packet:read" | "shop:spend" | "account:act" | "chat:send" | "room:act" | "friends:write" | "network"
  | "chat:read" | "chat:private:read" | "game:read" | "account:read" | "friends:read" | "room:read"
  | "ui:panel" | "ui:overlay" | "theme" | "storage" | "notify" | "sound" | "commands"
  | "rooms:join" | "profile:read" | "ui:menu" | "ui:profile" | "ui:dialog" | "clipboard";

export interface ModEvents {
  /** chat:read - сообщение общего чата */
  "chat:message": { username?: string, text: string }
  /** room:read - сообщение в комнате, где ты сейчас */
  "room:message": { username?: string, text: string }
  /** game:read - любое изменение комнаты, тот же снимок, что `mod.room.state()` */
  "room:state": RoomSnapshot
  /** game:read - игрок перешёл на другой экран: "menu", "rooms", "room", "friends"… */
  "screen:change": { name: string }
  /** packet:read - любой пакет от сервера как есть (кроме ответа на вход: в нём токен) */
  "packet": { name: string, data: unknown }
}

/** действия с игроком: kill, check, heal, love, explode, interview, guard, pour */
export type RoomAction = "kill" | "check" | "heal" | "love" | "explode" | "interview" | "guard" | "pour";

export interface RoomSnapshot {
  id: string
  title: string
  /** registration - набор игроков, preparation - подготовка, game - идёт игра, finished - игра закончилась */
  phase: "registration" | "preparation" | "game" | "finished"
  /** секунд до конца этапа */
  timer: number
  /** только во время игры */
  time?: "night" | "day"
  /** какая по счёту ночь или день: 1 или 2. Порядок такой: 1 ночь, 2 ночь, 1 день, 2 день */
  part?: 1 | 2
  /** четыре этапа по ролям: lover, night, bodyguard, vote */
  step?: "lover" | "night" | "bodyguard" | "vote"
  me?: { index: number, role?: number, roleName?: string, alive: boolean }
  players: {
    index: number
    username: string
    playerObjectId: string
    alive: boolean
    /** роль, если она тебе известна: твоя, раскрытые, союзники по команде. Иначе undefined */
    role?: number
    roleName?: string
    /** мафия ли (мафия, террорист, бармен, информатор); известно только вместе с ролью */
    mafia?: boolean
    votes: number
    /** что ты можешь сделать с этим игроком прямо сейчас; undefined - ничего */
    action?: RoomAction
  }[]
  /** хост: сервер его не сообщает, это первый игрок комнаты по порядку */
  host?: { playerObjectId: string, username: string }
  /** роль → сколько таких игроков в этой игре */
  roles?: Record<string, number>
}

/** комната в списке комнат (данные для меню комнаты) */
export interface RoomMenuData {
  id: string
  title: string
  playersNum: number
  minPlayers: number
  maxPlayers: number
  minLevel: number
  /** 0 - регистрация, 3 - игра идёт, остальное - подготовка */
  status: number
  hasPassword: boolean
  vip: boolean
  friendsInRoom: number
}

/** игрок за столом (данные для меню игрока) */
export interface PlayerMenuData {
  index: number
  username: string
  playerObjectId: string
  alive: boolean
  role?: number
  roleName?: string
  /** что ты можешь сделать с этим игроком прямо сейчас */
  action?: RoomAction
}

/** комната, в которой ты сейчас (данные для настроек комнаты и окна «Игра окончена») */
export interface RoomInfoData {
  id: string
  title: string
  minPlayers: number
  maxPlayers: number
  minLevel: number
  vip: boolean
  roles: number[]
  /** сервер хоста не сообщает: это первый игрок комнаты по порядку */
  host?: { playerObjectId: string, username: string }
}

export interface GameOverData extends RoomInfoData {
  winner?: "mafia" | "peaceful" | "draw"
  /** победила ли твоя команда; undefined, пока неизвестно */
  won?: boolean
  /** награда от сервера: опыт, серебро, изменение рейтинга; активность в % */
  experience?: number
  silver?: number
  rating?: number
  activity?: number
}

/**
 * куда можно добавить пункты: room - меню комнаты в списке (ПКМ), player - меню игрока за столом,
 * roomSettings - кнопки в «Настройках» комнаты, gameOver - в «Игре окончена»
 */
export interface MenuTargets {
  room: RoomMenuData
  player: PlayerMenuData
  roomSettings: RoomInfoData
  gameOver: GameOverData
}

export interface MenuItem {
  id: string
  label: string
}

/** профиль игрока (чужой или свой), который открыт в окне */
export interface ProfileData {
  playerObjectId: string
  username: string
  isMe: boolean
  level: number
  playedGames: number
  winsAsMafia: number
  winsAsPeaceful: number
  /** роль (номер) → сколько игр сыграно */
  roleStatistics: Record<string, number>
  matchMakingScore: number
}

export interface ProfileRow {
  label: string
  value: string | number
  /** кнопка справа от значения; нажатие приходит в `action` */
  button?: { id: string, text: string }
}

export type PanelBlock = { type: "text", text: string } | { type: "button", id: string, text: string };

export interface Mod {
  permissions: {
    /** включено ли разрешение (игрок мог отключить); без него вызов вернёт ошибку */
    has(permission: Permission): boolean
    /** все включённые разрешения */
    readonly granted: Permission[]
  }
  on<E extends keyof ModEvents>(event: E, handler: (data: ModEvents[E]) => void): void
  chat: {
    /** chat:send */
    send(text: string): Promise<void>
  }
  room: {
    /** chat:send - написать в чат комнаты */
    say(text: string): Promise<void>
    /** room:read - только ники и «жив ли», без ролей */
    players(): Promise<{ index: number, username: string, alive: boolean }[]>
    /** game:read - всё о комнате: этап, роли, кто что может. `null`, если ты не в комнате */
    state(): Promise<RoomSnapshot | null>
    /** room:act - ход по твоей роли и времени суток; нельзя сейчас - ошибка */
    act(index: number): Promise<void>
    /** room:act - проголосовать днём за игрока; вне голосования - ошибка */
    vote(index: number): Promise<void>
    /** room:act - «Сдаться»; когда нельзя - ошибка */
    giveUp(): Promise<void>
    /** rooms:join - выйти из этой комнаты и создать такую же заново (без пароля: сервер его не присылает) */
    rehost(): Promise<void>
    /** room:act - ответить на голосование за исключение: true - выгнать */
    voteKick(vote: boolean): Promise<void>
  }
  screen: {
    /** game:read - какой экран открыт: "room", "menu", "rooms"… */
    current(): Promise<string | undefined>
  }
  account: {
    /** account:read - токена нет и не будет */
    info(): Promise<{ username: string, level: number, playerObjectId: string }>
  }
  /** notify - уведомление в углу экрана; `title` - заголовок, `kind` - значок и цвет */
  notify(text: string, options?: { title?: string, kind?: "info" | "success" | "warning" | "error" }): Promise<void>
  storage: {
    /** storage - у каждого мода своё хранилище */
    get(key: string): Promise<unknown>
    set(key: string, value: unknown): Promise<void>
    remove(key: string): Promise<void>
  }
  theme: {
    /** theme - временные цвета поверх темы игрока, пропадают при выключении мода */
    set(values: Record<string, string>): Promise<void>
    clear(): Promise<void>
  }
  net: {
    /** network - только https и только домены из manifest.json ("domains") */
    fetch(url: string): Promise<string>
  }
  rooms: {
    /** rooms:join - зайти в комнату как по нажатию на неё: спросит пароль и покажет причину отказа */
    enter(roomId: string): Promise<void>
    /** rooms:join - ждать свободного места и зайти, когда оно появится */
    waitAndJoin(roomId: string): Promise<void>
  }
  clipboard: {
    /** clipboard */
    write(text: string): Promise<void>
  }
  menu: {
    /** ui:menu - пункты контекстного меню (до 12); медленный ответ (больше 0.5 с) игнорируется */
    add<T extends keyof MenuTargets>(target: T, menu: {
      items(data: MenuTargets[T]): MenuItem[] | Promise<MenuItem[]>
      select?(itemId: string, data: MenuTargets[T]): void | Promise<void>
    }): void
  }
  profile: {
    /** profile:read - открыть профиль игрока в окне игры */
    open(playerObjectId: string): Promise<void>
    /** ui:profile + profile:read - строки в профиле игрока (до 30) */
    section(section: {
      rows(profile: ProfileData): ProfileRow[] | Promise<ProfileRow[]>
      action?(rowButtonId: string, profile: ProfileData): void | Promise<void>
    }): void
  }
  commands: {
    /** commands - команда «/имя аргументы» в чатах; в чат она не отправляется */
    register(name: string, handler: (args: string[]) => void): void
  }
  ui: {
    /** ui:panel - панель мода в окне «Моды» */
    panel(panel: { title: string, blocks: PanelBlock[] }): void
    onAction(handler: (id: string) => void): void
    /** ui:dialog - окно с текстом (до 2000 символов) */
    dialog(dialog: { title?: string, text: string }): Promise<void>
  }
  log(...parts: unknown[]): void
}

/** единственная связь мода с игрой */
export const mod: Mod;

}
