import { JsonDocument, type FileStore } from "@common/storage";
import { isMafia as isMafiaRole } from "./room/state";

/** запись игры в формате старой версии (`/game/history.json`) */
export interface HistoryRecord {
  /** сообщения как их присылал сервер */
  messages: unknown[]
  /** последний пакет «игроки живы/мертвы» как пришёл */
  playersStat?: unknown
  playersData: Record<string, unknown>
  modelType: number
  title: string
  maxPlayers: number
  minPlayers: number
  minLevel: number
  isVipEnabled: boolean
  selectedRoles: number[]
  gameDayTime: number
  isMM?: boolean
  createdAt: number
  /** своё название и заметка к игре: задаёт игрок, старая версия их не знает */
  name?: string
  note?: string
}

export interface HistoryFile {
  rooms: HistoryRecord[]
  [extra: string]: unknown
}

export const historyDocument = (files: FileStore, path = "/game/history.json") =>
  new JsonDocument<HistoryFile>(files, {
    path,
    defaults: () => ({ rooms: [] }),
    migrate: raw => {
      const saved = (typeof raw == "object" && raw !== null ? raw : {}) as Partial<HistoryFile>;
      return { ...saved, rooms: Array.isArray(saved.rooms) ? saved.rooms : [] };
    }
  });

export const HISTORY_LIMIT = 100;

export const HISTORY_NAME_MAX = 40;
export const HISTORY_NOTE_MAX = 200;

/** как игра называется в списке: своё название, а если его нет - название комнаты */
export const recordTitle = (record: HistoryRecord) => record.name?.trim() || record.title || "Игра";

/** новая игра - первой в списке; хранится не больше 100 последних, чтобы файл не рос бесконечно */
export const withRecord = (rooms: readonly HistoryRecord[], record: HistoryRecord): HistoryRecord[] => [record, ...rooms].slice(0, HISTORY_LIMIT);

export type Outcome = "win" | "lose" | "draw";

/** чем закончилась игра для вас: по тому, кого осталось больше (мафии или мирных), и вашей роли */
export function outcomeOf(record: HistoryRecord, myPlayerObjectId: string): Outcome | undefined {
  const me = record.playersData?.[myPlayerObjectId] as { role?: number } | undefined;
  const stat = record.playersStat as { m?: unknown, c?: unknown } | undefined;
  if(!me || typeof me.role != "number" || typeof stat?.m != "number" || typeof stat.c != "number") return undefined;

  if(stat.m == stat.c) return "draw";
  const mafiaWon = stat.m > stat.c;
  return mafiaWon == isMafiaRole(me.role) ? "win" : "lose";
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value == "object" && value !== null && !Array.isArray(value);
const num = (value: unknown, fallback: number) => typeof value == "number" && Number.isFinite(value) ? value : fallback;

/**
 * запись, присланная другим игроком, - чужие данные: берём только поля нужных типов и ограничиваем размеры
 * что внутри сообщений, разбирают обычные обработчики, они повреждённое пропускают
 */
export function sanitizeRecord(raw: unknown): HistoryRecord | undefined {
  if(!isObject(raw) || !Array.isArray(raw.messages) || !isObject(raw.playersData)) return undefined;
  if(raw.messages.length > 3000) return undefined;
  const players = Object.entries(raw.playersData);
  if(players.length > 40) return undefined;

  return {
    messages: raw.messages.filter(isObject),
    playersStat: isObject(raw.playersStat) ? raw.playersStat : undefined,
    playersData: Object.fromEntries(players.filter(([, value]) => isObject(value))),
    modelType: num(raw.modelType, 0),
    title: typeof raw.title == "string" ? raw.title.slice(0, 80) : "Игра",
    maxPlayers: num(raw.maxPlayers, 8),
    minPlayers: num(raw.minPlayers, 1),
    minLevel: num(raw.minLevel, 1),
    isVipEnabled: raw.isVipEnabled === true,
    selectedRoles: Array.isArray(raw.selectedRoles) ? raw.selectedRoles.filter((role): role is number => typeof role == "number").slice(0, 30) : [],
    gameDayTime: num(raw.gameDayTime, 0),
    isMM: raw.isMM === true,
    createdAt: num(raw.createdAt, Date.now()),
    name: typeof raw.name == "string" && raw.name.trim() ? raw.name.trim().slice(0, HISTORY_NAME_MAX) : undefined,
    note: typeof raw.note == "string" && raw.note.trim() ? raw.note.trim().slice(0, HISTORY_NOTE_MAX) : undefined
  };
}
