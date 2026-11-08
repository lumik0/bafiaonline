/** тексты сообщений чата комнаты по их типам: события и реплики показываются одними словами. Типы - как у сервера; тут нет ничего, что зависит от окна */

/** смысл сообщения: от него зависит цвет (в игре - токены темы `chat-…`) */
export type ToneName = "text" | "vote" | "danger" | "info" | "day" | "dead" | "night";

/** «говорящие» роли: типы сообщений Мафии (11), Информатора (26), Бармена (29) */
export const SPEAKERS: Record<number, string> = { 11: "Мафия", 26: "Информатор", 29: "Бармен" };

/** сообщения с этими типами - события, а не реплики игроков, даже если у них есть игрок: вход, выход, убийство, голосования за исключение */
export const EVENT_TYPES = [2, 3, 13, 24, 25];

/** ники в тексте оборачиваются в [скобки]: чат подсветит ваш, а при «Скрывать никнейм» размоет его */
export const nick = (name: string | undefined) => `[${name ?? "?"}]`;

/** системные сообщения по типу. Номера типов - как у сервера (см. комментарии) */
export function systemText(type: number | undefined, text: string, user: string | undefined, target: string | undefined): { text: string, tone: ToneName } | undefined {
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
export function speechText(type: number | undefined, text: string): { text: string, tone: ToneName, nickTone?: ToneName, label?: string } {
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

