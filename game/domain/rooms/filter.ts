import { JsonDocument, type FileStore } from "@common/storage";
import { defaultSortRules, normalizeSortRules, type RoomItem, type SortRule } from "./room";

/** настройки фильтра комнат. Формат файла `/game/filter.json` - как в старой версии */
export interface RoomFilter {
  version: number
  enabled: boolean
  minPl: number
  maxPl: number
  minLvl: number
  maxLvl: number
  friends: boolean
  vip: boolean
  withoutVip: boolean
  withPassword: boolean
  withoutPassword: boolean
  isRegistration: boolean
  isStarted: boolean
  /** дополнительные роли, по которым ищем */
  roles: number[]
  /** наоборот: только комнаты, где этих ролей нет */
  noRoles: boolean
  /** сортировка списка: критерии по приоритету (новое поле: старая версия его не читает и не портит) */
  sortRules: SortRule[]
}

export const defaultFilter = (): RoomFilter => ({
  version: 1, enabled: false, minPl: 5, maxPl: 21, minLvl: 1, maxLvl: 11,
  friends: false, vip: false, withoutVip: false, withPassword: false, withoutPassword: false,
  isRegistration: true, isStarted: true, roles: [2, 5, 6, 7, 8, 9, 10, 11], noRoles: false, sortRules: defaultSortRules()
});

const num = (value: unknown, fallback: number) => typeof value == "number" && Number.isFinite(value) ? value : fallback;
const bool = (value: unknown, fallback: boolean) => typeof value == "boolean" ? value : fallback;

export const filterDocument = (files: FileStore, path = "/game/filter.json") =>
  new JsonDocument<RoomFilter>(files, {
    path,
    defaults: defaultFilter,
    migrate(raw) {
      const saved = (typeof raw == "object" && raw !== null ? raw : {}) as Record<string, unknown>;
      const d = defaultFilter();
      return {
        ...saved,
        version: 1,
        enabled: bool(saved.enabled, d.enabled), minPl: num(saved.minPl, d.minPl), maxPl: num(saved.maxPl, d.maxPl),
        minLvl: num(saved.minLvl, d.minLvl), maxLvl: num(saved.maxLvl, d.maxLvl),
        friends: bool(saved.friends, d.friends), vip: bool(saved.vip, d.vip), withoutVip: bool(saved.withoutVip, d.withoutVip),
        withPassword: bool(saved.withPassword, d.withPassword), withoutPassword: bool(saved.withoutPassword, d.withoutPassword),
        isRegistration: bool(saved.isRegistration, d.isRegistration), isStarted: bool(saved.isStarted, d.isStarted),
        roles: Array.isArray(saved.roles) ? saved.roles.filter((role): role is number => typeof role == "number") : d.roles,
        noRoles: bool(saved.noRoles, d.noRoles),
        sortRules: normalizeSortRules(saved.sortRules)
      };
    }
  });

/** подходит ли комната под поиск по названию и (если фильтр включён) под фильтр */
export function matchesRoom(room: RoomItem, filter: RoomFilter, search = ""): boolean {
  const query = search.trim().toLowerCase();
  if(query && !room.title.toLowerCase().includes(query)) return false;
  if(!filter.enabled) return true;

  if(room.status == 0 && !filter.isRegistration) return false;
  if(room.status == 3 && !filter.isStarted) return false;
  if(room.minLevel < filter.minLvl || room.minLevel > filter.maxLvl) return false;
  if(room.minPlayers < filter.minPl || room.maxPlayers > filter.maxPl) return false;
  if(filter.vip && !room.vip) return false;
  if(filter.withoutVip && room.vip) return false;
  if(filter.withPassword && !room.hasPassword) return false;
  if(filter.withoutPassword && room.hasPassword) return false;
  if(filter.friends && room.friendsInRoom <= 0) return false;

  const hasWanted = room.roles.some(role => filter.roles.includes(role));
  return filter.noRoles ? !hasWanted : hasWanted;
}
