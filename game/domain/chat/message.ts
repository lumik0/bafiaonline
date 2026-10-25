import { GIF_TAG, HIST_TAG } from "@common/bafia/protocol";
import type { ServerData } from "@common/protocol";
import { normalizeDecorations, type Decorations } from "../decorations";
import { MessageType } from "../enums";

type RawMessage = ServerData<"chatMessage">["message"];

export interface ChatUser {
  objectId?: string
  playerObjectId?: string
  username: string
  photo?: string
  vip?: string
  /** своя картинка вместо фото (Мафия, Бармен, Информатор): путь в ассетах */
  asset?: string
  /** украшения: цвет, фон и тень ника, рамка фото */
  decorations?: Decorations
}

/** join/leave/kill - события с игроком (аватарка, ник): «Игрок … вошёл / вышел / УБИТ!» */
export type EntryKind = "message" | "join" | "leave" | "kill" | "system";

export interface ChatEntry {
  /** уникален в списке: по нему Solid не пересоздаёт уже нарисованные строки */
  id: number
  kind: EntryKind
  text: string
  type?: number
  sticker?: boolean
  user?: ChatUser
  /** время (мс) - у личных сообщений */
  created?: number
  /** личное сообщение, которое собеседник ещё не прочитал */
  unread?: boolean
  /** цвет текста по смыслу (голосование, убийство, ночь…); без него цвет берётся по `type` */
  tone?: Tone
  /** цвет ника, если отличается (сообщения мёртвых, информатора) */
  nickTone?: Tone
  /** пометка после ника: «последнее сообщение», «сообщение мертвеца» */
  label?: string
  /** голосование за исключение игрока: к строке добавляются кнопки «Выгнать» / «Не выгонять» */
  kickVote?: { targetPlayerObjectId?: string }
}

export type Tone = "text" | "vote" | "danger" | "info" | "day" | "dead" | "night";

/** имя токена темы для смысла сообщения */
export const toneToken = (tone: Tone | undefined): string => ({
  text: "chat-text", vote: "chat-vote", danger: "chat-danger", info: "chat-info", day: "chat-day", dead: "chat-dead", night: "chat-night"
})[tone ?? "text"];

let nextId = 1;

const vipText = (vip: unknown) => typeof vip == "string" && vip ? vip : typeof vip == "number" && vip ? String(vip) : undefined;

export function toChatUser(raw: NonNullable<RawMessage["user"]>): ChatUser {
  return { objectId: raw.objectId, playerObjectId: raw.playerObjectId, username: raw.username ?? "", photo: raw.photo, vip: vipText(raw.vip), decorations: normalizeDecorations(raw.decorations) };
}

/** пакет сервера в строку чата; вход и выход - отдельные виды */
export function toEntry(raw: RawMessage): ChatEntry {
  const user = raw.user ? toChatUser(raw.user) : undefined;
  const type = raw.type;
  const kind: EntryKind = type == MessageType.UserHasEntered ? "join" : type == MessageType.UserHasLeft ? "leave" : user ? "message" : "system";
  return { id: nextId++, kind, text: raw.text ?? "", type, sticker: raw.sticker, user };
}

/** список строк чата: не больше `max`, а повторные «вошёл/вышел» одного игрока заменяют предыдущие */
export class MessageList {
  entries: ChatEntry[] = [];

  constructor(private max = 150) {}

  add(entry: ChatEntry) {
    let entries = this.entries;
    if((entry.kind == "join" || entry.kind == "leave") && entry.user) {
      const name = entry.user.username;
      entries = entries.filter(other => !((other.kind == "join" || other.kind == "leave") && other.user?.username == name));
    }
    entries = [...entries, entry];
    this.entries = entries.length > this.max ? entries.slice(entries.length - this.max) : entries;
  }

  replace(entries: ChatEntry[]) {
    this.entries = [];
    for(const entry of entries) this.add(entry);
  }
}

export type Segment =
  | { kind: "text", text: string }
  | { kind: "emoji", name: string }
  /** `[gif:номер]`: гифку подставляет сервер Бафии, если игрок согласился */
  | { kind: "gif", id: string }
  /** `[hist:номер]`: игра, присланная в личном сообщении */
  | { kind: "hist", id: string }
  | { kind: "mention", text: string, mine: boolean };

const TOKEN = /(:sm[1-6]:|\[[^\[\]]+\])/g;

/** разбирает текст на обычный, смайлики `:sm1:` и упоминания `[Ник]`. HTML не интерпретируется нигде */
export function parseText(text: string, myName?: string): Segment[] {
  return text.split(TOKEN).filter(Boolean).map((part): Segment => {
    if(/^:sm[1-6]:$/.test(part)) return { kind: "emoji", name: part.slice(1, -1) };
    const hist = HIST_TAG.exec(part);
    if(hist) return { kind: "hist", id: hist[1]! };
    const gif = GIF_TAG.exec(part);
    if(gif) return { kind: "gif", id: gif[1]! };
    if(part.startsWith("[") && part.endsWith("]")) return { kind: "mention", text: part, mine: !!myName && part.slice(1, -1) == myName };
    return { kind: "text", text: part };
  });
}

export interface Group {
  key: number
  user: ChatUser
  entries: ChatEntry[]
}

export type Row = { type: "group", group: Group } | { type: "line", entry: ChatEntry };

/** подряд идущие сообщения одного игрока собираются под одним ником и аватаром */
export function toRows(entries: readonly ChatEntry[]): Row[] {
  const rows: Row[] = [];
  let current: Group | undefined;

  for(const entry of entries) {
    if(entry.kind != "message" || !entry.user) {
      rows.push({ type: "line", entry });
      current = undefined;
    } else if(current && current.user.username == entry.user.username) {
      current.entries.push(entry);
    } else {
      current = { key: entry.id, user: entry.user, entries: [entry] };
      rows.push({ type: "group", group: current });
    }
  }
  return rows;
}

const sameRow = (a: Row, b: Row) =>
  a.type == b.type && (a.type == "line"
    ? a.entry === (b as typeof a).entry
    : a.group.entries.length == (b as typeof a).group.entries.length && a.group.entries.every((entry, i) => entry === (b as typeof a).group.entries[i]));

/**
 * строки, которые не изменились, остаются теми же объектами: Solid не перерисовывает их заново
 * (иначе при каждом новом сообщении мигали бы аватарки всего чата)
 */
export function stableRows(previous: readonly Row[], next: Row[]): Row[] {
  const byKey = new Map(previous.map(row => [row.type == "line" ? row.entry.id : row.group.key, row]));
  return next.map(row => {
    const old = byKey.get(row.type == "line" ? row.entry.id : row.group.key);
    return old && sameRow(old, row) ? old : row;
  });
}

/** цвет системных сообщений: голосование, убийство, итоги и т. п. Возвращает имя токена темы */
export function colorToken(type: number | undefined): "chat-text" | "chat-vote" | "chat-dead" | "chat-info" | "chat-giveup" {
  switch(type) {
    case MessageType.VotesFor: return "chat-vote";
    case MessageType.KilledPlayerMessage: return "chat-dead";
    case MessageType.KilledUserMessage: return "chat-info";
    case MessageType.GiveUp: return "chat-giveup";
    default: return "chat-text";
  }
}

/** «Опьянение» бармена: сообщение, начинающееся с выбранного символа, уходит заменой на случайные знаки */
export function applyBarmanEffect(message: string, effect: string, random: () => number = Math.random): string {
  if(!effect || !message.startsWith(effect)) return message;
  const symbols = "?!&@#%^~<>*";
  return Array.from({ length: [...message].length - 1 }, () => symbols[Math.floor(random() * symbols.length)]).join("");
}

/**
 * «@3 » превращается в `[Ник] ` третьего игрока за столом: так быстро называют игрока по номеру
 * `lookup` получает номер с единицы; если игрока нет, текст не меняется (возвращается `undefined`)
 */
export function expandMentionNumber(value: string, lookup: (number: number) => string | undefined): string | undefined {
  const match = value.match(/(^|\s)@(\d+)\s$/);
  const name = match ? lookup(Number(match[2])) : undefined;
  return match && name ? value.replace(/(^|\s)@\d+\s$/, `$1[${name}] `) : undefined;
}

/** вставка или удаление `[ник]` в поле ввода по клику на ник. Возвращает новый текст и положение курсора */
export function toggleMention(value: string, caret: number, username: string): { value: string, caret: number } {
  const mention = `[${username}]`;
  const index = value.indexOf(mention);

  if(index != -1) {
    // убираем упоминание вместе с одним соседним пробелом
    const before = value.slice(0, index), after = value.slice(index + mention.length);
    const cleaned = before.endsWith(" ") && after.startsWith(" ") ? before + after.slice(1)
      : before.endsWith(" ") && after == "" ? before.slice(0, -1)
      : before + (after.startsWith(" ") ? after.slice(1) : after);
    return { value: cleaned, caret: Math.min(before.length, cleaned.length) };
  }

  const head = value.slice(0, caret), tail = value.slice(caret);
  const insert = `${head == "" || head.endsWith(" ") ? "" : " "}${mention} `;
  return { value: head + insert + tail, caret: head.length + insert.length };
}
