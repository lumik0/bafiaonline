import type { BafiaRoomAdapter } from "../bafia-room";
import { sessionDeps } from "../room/deps";
import { RoomSession } from "../room/session";
import type { GameContext } from "../../context";

/** почему не удалось войти в комнату Бафии или создать её, понятным языком */
export const bafiaRoomProblems: Record<string, string> = {
  offline: "Сервер Бафии сейчас недоступен.",
  "presence-first": "Сервер Бафии ещё не узнал тебя: подожди пару секунд и повтори.",
  full: "Комната заполнена.",
  started: "Игра в этой комнате уже началась.",
  nick: "В комнате уже есть игрок с таким ником.",
  "no-room": "Такой комнаты уже нет.",
  "in-room": "Ты уже в другой комнате Бафии.",
  forbidden: "Создавать комнаты Бафии пока может не каждый.",
  limit: "Сейчас идёт слишком много комнат Бафии. Попробуй позже.",
  premium: "Эта комната только для игроков с премиумом.",
  "need-password": "У комнаты есть пароль.",
  password: "Неверный пароль.",
  "bad-config": "Настройки комнаты не подходят: проверь число игроков и роли."
};

/** открыть экран комнаты Бафии: сессия работает поверх адаптера, который переводит события Бафии в привычные экрану пакеты */
export function openBafiaRoom(ctx: GameContext, adapter: BafiaRoomAdapter) {
  const session = new RoomSession({ ...sessionDeps(ctx), client: adapter.client as never, myPlayerObjectId: adapter.you }, adapter.settings());
  session.bafia = adapter;
  session.state.waitText = true;
  session.start();
  ctx.nav.push("room", { session });
}
