import type { ServerData } from "@common/protocol";
import { toChatUser, type ChatEntry, type Tone } from "../chat/message";

type Raw = ServerData<"chatMessage">["message"];

let nextId = 1_000_000;

/** сообщение приходит как объект с ключами 0, 1… или массив: берём первого участника */
export function firstTarget(targets: unknown): { username?: string, playerObjectId?: string } | undefined {
  const first = Array.isArray(targets) ? targets[0] : typeof targets == "object" && targets !== null ? (targets as Record<string, unknown>)["0"] : undefined;
  if(typeof first != "object" || first === null) return undefined;
  const { u, puo } = first as { u?: unknown, puo?: unknown };
  return { username: typeof u == "string" ? u : undefined, playerObjectId: typeof puo == "string" ? puo : undefined };
}

/** ники в тексте оборачиваются в [скобки]: чат подсветит ваш, а при «Скрывать никнейм» размоет его */
const nick = (name: string | undefined) => `[${name ?? "?"}]`;

/** системные сообщения по типу. Номера типов - как у сервера (см. комментарии) */
function system(type: number | undefined, text: string, user: string | undefined, target: string | undefined): { text: string, tone: Tone } | undefined {
  const [first, , second] = text.split("#");
  switch(type) {
    case 4: return { text: "Игра началась", tone: "text" };
    case 6: return { text: "Наступила ночь [МАФИЯ в чате]", tone: "info" };
    case 7: return { text: "[МАФИЯ выбирает жертву]", tone: "info" };
    case 8: return { text: "Наступил день [Все общаются в чате]", tone: "day" };
    case 9: return { text: "[Все голосуют] Выбери игрока, которого хочешь казнить", tone: "day" };
    case 13: return { text: `Игрок ${nick(user)} УБИТ!`, tone: "danger" };
    case 15: return { text: "ВСЕ остались живы. Никого не удалось убить!", tone: "vote" };
    case 16: return { text: "Игра окончена! МИРНЫЕ ЖИТЕЛИ победили!", tone: "vote" };
    case 17: return { text: "Игра окончена! МАФИЯ победила!", tone: "vote" };
    case 20: return { text: `СРОЧНАЯ НОВОСТЬ!\nЖурналист провел расследование и как оказалось игроки ${nick(first)} и ${nick(second)} играют в одной команде`, tone: "danger" };
    case 21: return { text: `СРОЧНАЯ НОВОСТЬ!\nЖурналист провел расследование и как оказалось игроки ${nick(first)} и ${nick(second)} играют в разных командах`, tone: "danger" };
    case 22: return { text: "ничья", tone: "text" };
    case 24: return { text: `${nick(user)} начал голосование, чтобы выгнать игрока ${nick(target)} из комнаты`, tone: "info" };
    case 25: { const [yes, no] = text.split("|"); return { text: `Завершилось голосование. Выгнать игрока?\nРезультат голосования:\nДа: ${yes} | Нет: ${no}`, tone: "info" }; }
    default: return undefined;
  }
}

/** реплики от лица игроков и ролей */
function speech(type: number | undefined, text: string): { text: string, tone: Tone, nickTone?: Tone, label?: string } {
  switch(type) {
    case 10: case 14: return { text: `Голосует за [${text}]`, tone: "vote" };
    // последнее сообщение убитого игрока: серое целиком (в старой версии серым был только ник)
    case 12: return { text, tone: "dead", nickTone: "dead", label: "последнее сообщение" };
    case 28: return { text: "Сдался", tone: "danger" };
    case 18: return { text, tone: "info" };
    case 19: return { text: `ВЗОРВАЛ игрока [${text}]`, tone: "danger" };
    case 22: return { text: `ВЗОРВАЛ игрока [${text}], но игрок был под защитой телохранителя и остался жив!`, tone: "danger" };
    // сообщение мертвеца в его чате: и ник, и текст одного цвета
    case 17: return { text, tone: "night", nickTone: "night", label: "убит" };
    default: return { text, tone: "text" };
  }
}

/** аватарки ролей, которые «говорят» ночью (как в старой версии): Мафия, Бармен; у Информатора - безликая */
const SPEAKER_AVATARS: Record<string, string> = {
  "Мафия": "textures/roles/mafia_chat.png",
  "Бармен": "textures/roles/barman_chat.png",
  "Информатор": "textures/roles/unknown_chat.png"
};

/** сообщение чата комнаты → строка для ChatView */
export function toRoomEntry(raw: Raw): ChatEntry {
  const type = raw.type;
  const text = raw.text ?? "";
  const user = raw.user ? toChatUser(raw.user) : undefined;
  const base = { id: nextId++, type, sticker: raw.sticker };

  if(type == 2 || type == 3) return { ...base, kind: type == 2 ? "join" : "leave", text: "", user };

  // сообщения игроков и «говорящих» ролей: Мафия (11), Информатор (26), Бармен (29)
  const speaker = type == 11 ? "Мафия" : type == 26 ? "Информатор" : type == 29 ? "Бармен" : undefined;
  const isSpeech = (user && ![2, 3, 13, 24, 25].includes(type ?? -1)) || speaker;
  if(isSpeech) {
    const said = speech(type, text);
    // без пользователя - безликая картинка; у «говорящих» ролей своя
    const avatar = SPEAKER_AVATARS[speaker ?? ""] ?? "textures/roles/unknown_chat.png";
    return { ...base, kind: "message", user: user ?? { username: speaker ?? "???", asset: avatar }, ...said };
  }

  // убийство - событие с игроком: в чате у него аватарка и кликабельный ник
  if(type == 13) return { ...base, kind: "kill", text: "УБИТ!", user, tone: "danger" };

  const target = firstTarget(raw.targets);
  const described = system(type, text, user?.username, target?.username);
  return {
    ...base, kind: "system", user, text: described?.text ?? text, tone: described?.tone ?? "text",
    ...(type == 24 ? { kickVote: { targetPlayerObjectId: target?.playerObjectId } } : {})
  };
}
