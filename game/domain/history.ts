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
  /** чья это игра: игрок и его ник. Нужно при просмотре чужой игры, чтобы «твоя роль» и ник были его, а не зрителя */
  me?: { playerObjectId: string, username: string }
  /** аккаунт на этом устройстве, чья это запись (`userObjectId`): у каждого аккаунта своя история. Остаётся только здесь, при отправке другим убирается */
  owner?: string
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

/** описание игры одной строкой для списка выбора (до 70 знаков); пусто, если описания нет. С разделителем впереди, чтобы дописывать к названию */
export function noteHint(record: HistoryRecord): string {
  const text = record.note?.replace(/\s+/g, " ").trim();
  return text ? " - " + (text.length > 70 ? text.slice(0, 69) + "…" : text) : "";
}

/**
 * новая игра - первой в списке; у аккаунта, чья это игра, хранится не больше 100 последних, чтобы файл не рос бесконечно.
 * Чужие записи и записи без владельца не трогаем: они могли просто не опознаться (например, сменился id игрока), и стереть их навсегда нельзя
 */
export function withRecord(rooms: readonly HistoryRecord[], record: HistoryRecord): HistoryRecord[] {
  const owner = record.owner ?? "";
  let count = 0;
  return [record, ...rooms].filter(item => {
    if((item.owner ?? "") != owner) return true;
    return ++count <= HISTORY_LIMIT;
  });
}

/** кто смотрит историю: аккаунт и его игрок (по нему узнаются записи прежней общей истории) */
export interface HistoryViewer { userObjectId: string, playerObjectId: string }

/**
 * чья игра эта запись для данного аккаунта. У новых записей есть владелец; у старых (история была общей для всех аккаунтов
 * на устройстве) её узнаём по игроку: если ваш игрок сидел за столом, игра ваша
 */
export function belongsTo(record: HistoryRecord, viewer: HistoryViewer): boolean {
  if(record.owner) return record.owner == viewer.userObjectId;
  return !!viewer.playerObjectId && !!record.playersData && viewer.playerObjectId in record.playersData;
}

/** записи этого аккаунта: у каждого аккаунта на устройстве своя история */
export const ownRecords = (rooms: readonly HistoryRecord[], viewer: HistoryViewer): HistoryRecord[] => rooms.filter(record => belongsTo(record, viewer));

/** запись для отправки другому игроку: без привязки к аккаунту на этом устройстве */
export function sharedForm(record: HistoryRecord): HistoryRecord {
  const { owner: _owner, ...shared } = record;
  return shared;
}

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
    note: typeof raw.note == "string" && raw.note.trim() ? raw.note.trim().slice(0, HISTORY_NOTE_MAX) : undefined,
    me: isObject(raw.me) && typeof raw.me.playerObjectId == "string" && typeof raw.me.username == "string" && raw.me.playerObjectId.length <= 64
      ? { playerObjectId: raw.me.playerObjectId, username: raw.me.username.slice(0, 32) } : undefined
  };
}

/** записи без владельца (старая общая история), которые этот аккаунт сейчас не опознаёт как свои: по ним можно предложить вернуть их в историю */
export const unclaimedRecords = (rooms: readonly HistoryRecord[], viewer: HistoryViewer): HistoryRecord[] =>
  rooms.filter(record => !record.owner && !belongsTo(record, viewer));

/** отдаёт записи без владельца этому аккаунту; записи, у которых владелец уже есть, не меняются */
export const claimRecords = (rooms: readonly HistoryRecord[], viewer: HistoryViewer): HistoryRecord[] =>
  rooms.map(record => !record.owner && !belongsTo(record, viewer) && viewer.userObjectId ? { ...record, owner: viewer.userObjectId } : record);
