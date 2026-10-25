import type { ChatEntry } from "./message";

/** пример переписки для редактора темы: по одной строке каждого цвета, который можно настроить */
export const DEMO_NAME = "Игрок";

export function demoEntries(): ChatEntry[] {
  const anna = { username: "Аня", playerObjectId: "demo-anna" };
  const boris = { username: "Боря", playerObjectId: "demo-boris" };
  const me = { username: DEMO_NAME, playerObjectId: "demo-me" };
  return [
    { id: 1, kind: "join", text: "", user: anna },
    { id: 2, kind: "message", text: "Всем привет! Начинаем?", user: anna },
    { id: 3, kind: "message", text: `[${DEMO_NAME}], ты с нами?`, user: boris },
    { id: 4, kind: "message", text: "Да, уже тут", user: me },
    { id: 5, kind: "leave", text: "", user: boris },
    { id: 6, kind: "system", text: "Игра началась" },
    { id: 7, kind: "system", text: "Наступила ночь [МАФИЯ в чате]", tone: "night" },
    { id: 8, kind: "system", text: "Наступил день [Все общаются в чате]", tone: "day" },
    { id: 10, kind: "message", text: "Я думаю [Боря] маф", user: anna },
    { id: 8, kind: "system", text: "[Все голосуют] Выбери игрока, которого хочешь казнить", tone: "day" },
    { id: 9, kind: "message", text: "Голосую за Борю", user: anna, tone: "vote" },
    { id: 11, kind: "kill", text: "", user: boris, tone: "danger" },
    { id: 12, kind: "message", text: "Пока всем", user: boris, tone: "dead", nickTone: "dead", label: "последнее сообщение" },
    { id: 13, kind: "system", text: "Игрок сдался", tone: "danger" }
  ];
}
