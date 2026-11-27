import { demoEntries } from "../chat/demo";
import { Role } from "../enums";
import { RoomSession, type SessionDeps } from "./session";

/** комната-пример для предпросмотра оформления: идёт игра, сеть не нужна и ничего не отправляется */
export function demoRoomSession(deps: SessionDeps, night: boolean): RoomSession {
  const names = ["Аня", "Боря", "Вика", "Глеб", "Дима", "Лена"];
  const roles = [Role.Doctor, Role.Sheriff, Role.Civilian, Role.Lover, Role.Civilian, Role.Mafia];
  const session = new RoomSession(deps, {
    id: "demo", modelType: 0, title: "Новички", minPlayers: 6, maxPlayers: 15, minLevel: 1, vip: false, roles: [Role.Doctor, Role.Sheriff, Role.Lover, Role.Mafia, Role.Civilian]
  });
  const { state } = session;
  state.status = 3;
  state.loaded = true;
  state.timer = 25;
  state.stat = { mafiaAll: 2, mafiaAlive: 2, civilianAll: 4, civilianAlive: 4 };
  state.roleCounts = { [Role.Doctor]: 1, [Role.Sheriff]: 1, [Role.Mafia]: 2, [Role.Lover]: 1, [Role.Civilian]: 1 };
  state.players = [
    { playerObjectId: deps.myPlayerObjectId, username: deps.myUsername ?? "Игрок", index: 0, alive: true, role: Role.Mafia, affectedByRoles: [], vote: 0 },
    ...names.slice(0, 5).map((username, position) => ({ playerObjectId: "demo-" + position, username, index: position + 1, alive: true, role: roles[position], affectedByRoles: [], vote: 0 }))
  ];
  for(const entry of demoEntries()) state.messages.add(entry);
  state.dayTime = night ? 1 : 2;
  // выход из комнаты и отправка сообщений для примера отключены
  (session as unknown as { left: boolean }).left = true;
  session.send = () => {};
  session.act = () => {};
  session.giveUp = () => {};
  return session;
}

/** сменить время суток в комнате-примере */
export function setDemoNight(session: RoomSession, night: boolean) {
  session.state.setDayTime(night ? 1 : 2, 25);
}
