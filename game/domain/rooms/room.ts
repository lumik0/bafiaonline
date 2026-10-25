import type { ServerData } from "@common/protocol";

type Info = ServerData<"roomAdded">["room"];

export interface RoomItem {
  id: string
  title: string
  minLevel: number
  minPlayers: number
  maxPlayers: number
  roles: number[]
  hasPassword: boolean
  vip: boolean
  friendsInRoom: number
  playersNum: number
  /** создатель комнаты (хост), если сервер его прислал */
  creator?: string
  /** 0 - регистрация, 3 - игра идёт, иначе - подготовка */
  status: number
  /** 0 - вы играете здесь, 1 - вас убили здесь, 2 - вы не в комнате */
  myStatus: number
}

export function toRoom(info: Info): RoomItem | undefined {
  if(!info.id) return undefined;
  return {
    id: info.id,
    title: info.title ?? "",
    minLevel: info.minLevel ?? 1,
    minPlayers: info.minPlayers ?? 0,
    maxPlayers: info.maxPlayers ?? 0,
    roles: info.roles ?? [],
    hasPassword: !!info.password,
    vip: !!info.vip || !!info.vipEnabled,
    friendsInRoom: info.friendsInRoom ?? 0,
    playersNum: info.playersNum ?? 0,
    creator: info.creator,
    status: info.status ?? 0,
    myStatus: info.myStatus ?? 2
  };
}

/** сначала комнаты, где вы играете, потом те, что ждут игроков, потом по уровню */
export function sortRooms(rooms: readonly RoomItem[]): RoomItem[] {
  return [...rooms].sort((a, b) => a.myStatus - b.myStatus || a.status - b.status || a.minLevel - b.minLevel);
}

export type SortKey = "friends" | "status" | "level" | "players" | "free" | "title" | "vip" | "password";

/** один критерий сортировки: включён ли он и в какую сторону. Порядок в списке - приоритет */
export interface SortRule {
  key: SortKey
  on: boolean
  /** true - «по убыванию»: больше сверху (у да/нет: «да» сверху) */
  desc: boolean
}

export const sortCriteria: Record<SortKey, { label: string, hint: string, /** Подписи направлений: по возрастанию / по убыванию */ dir: [string, string], compare: (a: RoomItem, b: RoomItem) => number, desc: boolean, on: boolean }> = {
  friends: { label: "Друзья в комнате", hint: "сколько твоих друзей играет", dir: ["меньше друзей сверху", "больше друзей сверху"], compare: (a, b) => a.friendsInRoom - b.friendsInRoom, desc: true, on: false },
  status: { label: "Статус", hint: "регистрация, подготовка, игра", dir: ["регистрация сверху", "игра сверху"], compare: (a, b) => a.status - b.status, desc: false, on: true },
  level: { label: "Ранг", hint: "уровень комнаты", dir: ["низкий ранг сверху", "высокий ранг сверху"], compare: (a, b) => a.minLevel - b.minLevel, desc: false, on: true },
  players: { label: "Количество игроков", hint: "сколько сейчас в комнате", dir: ["меньше игроков сверху", "больше игроков сверху"], compare: (a, b) => a.playersNum - b.playersNum, desc: true, on: false },
  free: { label: "Свободные места", hint: "сколько ещё влезет", dir: ["меньше мест сверху", "больше мест сверху"], compare: (a, b) => (a.maxPlayers - a.playersNum) - (b.maxPlayers - b.playersNum), desc: true, on: false },
  title: { label: "Название", hint: "по алфавиту", dir: ["А → Я", "Я → А"], compare: (a, b) => a.title.localeCompare(b.title, "ru", { sensitivity: "base" }), desc: false, on: false },
  vip: { label: "VIP-комнаты", hint: "комнаты для VIP", dir: ["VIP снизу", "VIP сверху"], compare: (a, b) => Number(a.vip) - Number(b.vip), desc: true, on: false },
  password: { label: "Пароль", hint: "закрытые комнаты", dir: ["без пароля сверху", "с паролем сверху"], compare: (a, b) => Number(a.hasPassword) - Number(b.hasPassword), desc: false, on: false }
};

export const sortKeys = Object.keys(sortCriteria) as SortKey[];

/** обычный порядок: по статусу, потом по рангу - как в старой версии */
export const defaultSortRules = (): SortRule[] => partitionRules(sortKeys.map(key => ({ key, on: sortCriteria[key].on, desc: sortCriteria[key].desc })));

/** включённые правила первыми (порядок - приоритет), выключенные после */
export const partitionRules = (rules: readonly SortRule[]): SortRule[] => [...rules.filter(rule => rule.on), ...rules.filter(rule => !rule.on)];

/** приводит сохранённое к правилам: неизвестное и повторы убираются */
export function normalizeSortRules(raw: unknown): SortRule[] {
  const rules: SortRule[] = [];
  for(const item of Array.isArray(raw) ? raw as Partial<SortRule>[] : []) {
    if(typeof item?.key != "string" || !(item.key in sortCriteria) || rules.some(rule => rule.key == item.key)) continue;
    rules.push({ key: item.key as SortKey, on: item.on === true, desc: typeof item.desc == "boolean" ? item.desc : sortCriteria[item.key as SortKey].desc });
  }
  if(!rules.length) return defaultSortRules();
  for(const key of sortKeys) if(!rules.some(rule => rule.key == key)) rules.push({ key, on: false, desc: sortCriteria[key].desc });
  return partitionRules(rules);
}

/**
 * сначала комнаты, где вы играете или вас убили, потом включённые критерии
 * если всё равно - порядок «по статусу и рангу»
 */
export function orderRooms(rooms: readonly RoomItem[], rules: readonly SortRule[]): RoomItem[] {
  const active = rules.filter(rule => rule.on);
  return sortRooms(rooms).sort((a, b) => {
    if(a.myStatus != b.myStatus) return a.myStatus - b.myStatus;
    for(const rule of active) {
      const difference = sortCriteria[rule.key].compare(a, b);
      if(difference) return rule.desc ? -difference : difference;
    }
    return 0;
  });
}

export const statusText = (status: number) => status == 0 ? "Регистрация" : status == 3 ? "Игра началась" : "Подготовка";

/** порядок картинок ролей в карточке комнаты */
export const roleOrder = [2, 7, 10, 11, 9, 5, 6, 8];
export const sortRoles = (roles: readonly number[]) => [...roles].sort((a, b) => roleOrder.indexOf(a) - roleOrder.indexOf(b));

/** иконка уровня: комнаты 3, 5, 7, 9, 11 - ранги 2…6, остальные - первый */
export const roomRank = (minLevel: number) => minLevel == 3 ? 2 : minLevel == 5 ? 3 : minLevel == 7 ? 4 : minLevel == 9 ? 5 : minLevel == 11 ? 6 : 1;
