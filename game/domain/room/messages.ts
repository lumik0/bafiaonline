import type { ServerData } from "@common/protocol";
import { Role } from "../enums";
import { toChatUser, type ChatEntry, type Tone, type VisitRole } from "../chat/message";
import { EVENT_TYPES, nick, SPEAKERS, speechText, systemText } from "@common/room-text";

type Raw = ServerData<"chatMessage">["message"];

let nextId = 1_000_000;

/** сообщение приходит как объект с ключами 0, 1… или массив: берём первого участника */
export function firstTarget(targets: unknown): { username?: string, playerObjectId?: string } | undefined {
  const first = Array.isArray(targets) ? targets[0] : typeof targets == "object" && targets !== null ? (targets as Record<string, unknown>)["0"] : undefined;
  if(typeof first != "object" || first === null) return undefined;
  const { u, puo } = first as { u?: unknown, puo?: unknown };
  return { username: typeof u == "string" ? u : undefined, playerObjectId: typeof puo == "string" ? puo : undefined };
}

/** аватарки ролей, которые «говорят» ночью (как в старой версии): Мафия, Бармен; у Информатора - безликая */
const SPEAKER_AVATARS: Record<string, string> = {
  "Мафия": "textures/roles/mafia_chat.png",
  "Бармен": "textures/roles/barman_chat.png",
  "Информатор": "textures/roles/unknown_chat.png"
};

/** роли, которые ночью «приходят в гости»: слово в тексте и окончание глагола */
const VISITORS: Partial<Record<Role, { key: VisitRole, name: string, verb: string }>> = {
  [Role.Doctor]: { key: "doctor", name: "Доктор", verb: "пришёл" },
  [Role.Lover]: { key: "lover", name: "Любовница", verb: "пришла" },
  [Role.Sheriff]: { key: "sheriff", name: "Шериф", verb: "пришёл" },
  [Role.Barman]: { key: "barman", name: "Бармен", verb: "пришёл" },
  [Role.Informer]: { key: "informer", name: "Информатор", verb: "пришёл" },
  [Role.Mafia]: { key: "mafia", name: "Мафия", verb: "пришла" }
};

/** своё сообщение о ночном ходе: только у тебя в чате, сервер о нём не знает. Без подходящей роли и для мафии - `undefined` */
export function visitEntry(role: number | undefined, target: { username: string }, self: boolean): ChatEntry | undefined {
  const visitor = VISITORS[role as Role];
  // у мафии выбор жертвы - голосование, сервер сам пишет в чат «Голосует за ...», второе сообщение лишнее
  if(!visitor || role == Role.Mafia) return undefined;
  // игрок и так знает свою роль, поэтому «Ты», а не название роли
  return { id: nextId++, kind: "system", text: `Ты пришёл(-ла) к ${self ? "себе" : nick(target.username)}`, tone: `visit-${visitor.key}` };
}

/** к тебе пришла роль (сервер отметил её на тебе): «Доктор пришёл к тебе в гости» */
export function visitedEntry(role: number): ChatEntry | undefined {
  const visitor = VISITORS[role as Role];
  if(!visitor) return undefined;
  return { id: nextId++, kind: "system", text: `${visitor.name} ${visitor.verb} к тебе в гости`, tone: `visit-${visitor.key}` };
}

/** сообщение чата комнаты → строка для ChatView */
export function toRoomEntry(raw: Raw): ChatEntry {
  const type = raw.type;
  const text = raw.text ?? "";
  const user = raw.user ? toChatUser(raw.user) : undefined;
  const base = { id: nextId++, type, sticker: raw.sticker };

  if(type == 2 || type == 3) return { ...base, kind: type == 2 ? "join" : "leave", text: "", user };

  // сообщения игроков и «говорящих» ролей: Мафия (11), Информатор (26), Бармен (29)
  const speaker = SPEAKERS[type ?? -1];
  const isSpeech = (user && !EVENT_TYPES.includes(type ?? -1)) || speaker;
  if(isSpeech) {
    const said = speechText(type, text);
    // без пользователя - безликая картинка; у «говорящих» ролей своя
    const avatar = SPEAKER_AVATARS[speaker ?? ""] ?? "textures/roles/unknown_chat.png";
    return { ...base, kind: "message", user: user ?? { username: speaker ?? "???", asset: avatar }, ...said };
  }

  // убийство - событие с игроком: в чате у него аватарка и кликабельный ник
  if(type == 13) return { ...base, kind: "kill", text: "УБИТ!", user, tone: "danger" };

  const target = firstTarget(raw.targets);
  const described = systemText(type, text, user?.username, target?.username);
  return {
    ...base, kind: "system", user, text: described?.text ?? text, tone: described?.tone ?? "text",
    ...(type == 24 ? { kickVote: { targetPlayerObjectId: target?.playerObjectId } } : {})
  };
}
