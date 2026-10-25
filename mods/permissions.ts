export type Risk = "critical" | "high" | "medium" | "low";

export interface PermissionInfo {
  risk: Risk
  label: string
  /** false - разрешение объявлено, но API для него ещё нет */
  available: boolean
}

/** все разрешения модов. Игрок видит их при установке и может отключить любое отдельно */
export const permissions = {
  "packet:send": { risk: "critical", label: "Отправлять любые пакеты на сервер", available: false },
  "packet:read": { risk: "critical", label: "Видеть все пакеты от сервера", available: true },
  "shop:spend": { risk: "critical", label: "Покупки и траты валюты", available: false },
  "account:act": { risk: "critical", label: "Менять профиль, ник, фото, пароль", available: false },
  "chat:send": { risk: "high", label: "Писать в общий чат и в чат комнаты", available: true },
  "room:act": { risk: "high", label: "Ходить и голосовать в игре", available: true },
  "friends:write": { risk: "high", label: "Заявки в друзья, удаление друзей", available: false },
  "network": { risk: "high", label: "Запросы в интернет к доменам из манифеста", available: true },
  "rooms:join": { risk: "high", label: "Заходить в комнаты и создавать их", available: true },
  "chat:read": { risk: "medium", label: "Читать общий чат", available: true },
  "chat:private:read": { risk: "medium", label: "Читать личные сообщения", available: false },
  "game:read": { risk: "medium", label: "Видеть фазы игры, роли и голосования", available: true },
  "account:read": { risk: "medium", label: "Видеть ник и уровень (токена нет)", available: true },
  "friends:read": { risk: "medium", label: "Видеть список друзей", available: false },
  "profile:read": { risk: "medium", label: "Читать статистику профилей игроков", available: true },
  "room:read": { risk: "medium", label: "Видеть игроков и сообщения комнаты", available: true },
  "ui:panel": { risk: "low", label: "Своя панель в окне модов", available: true },
  "ui:overlay": { risk: "low", label: "Подсказки поверх игры", available: false },
  "ui:menu": { risk: "low", label: "Свои пункты в контекстных меню", available: true },
  "ui:profile": { risk: "low", label: "Свои строки в профиле игрока", available: true },
  "ui:dialog": { risk: "low", label: "Показывать окна с текстом", available: true },
  "clipboard": { risk: "low", label: "Копировать текст в буфер обмена", available: true },
  "theme": { risk: "low", label: "Менять цвета интерфейса", available: true },
  "storage": { risk: "low", label: "Своё изолированное хранилище", available: true },
  "notify": { risk: "low", label: "Показывать уведомления", available: true },
  "sound": { risk: "low", label: "Проигрывать звуки", available: false },
  "commands": { risk: "low", label: "Свои команды вроде /hello", available: true }
} as const satisfies Record<string, PermissionInfo>;

export type Permission = keyof typeof permissions;

export const isPermission = (value: unknown): value is Permission =>
  typeof value == "string" && Object.hasOwn(permissions, value);

const RISK_ORDER: Record<Risk, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export const riskOf = (permission: Permission): Risk => permissions[permission].risk;

/** самый опасный уровень из набора: по нему мод помечается в списке цветом */
export function highestRisk(list: readonly Permission[]): Risk {
  return list.reduce<Risk>((worst, permission) => RISK_ORDER[riskOf(permission)] < RISK_ORDER[worst] ? riskOf(permission) : worst, "low");
}

export const riskLabels: Record<Risk, string> = { critical: "критично", high: "высокий", medium: "средний", low: "низкий" };

/** какое разрешение нужно для вызова метода API мода */
export const methodPermissions = {
  "chat.send": "chat:send",
  "room.say": "chat:send",
  "screen.current": "game:read",
  "room.players": "room:read",
  "room.state": "game:read",
  "room.act": "room:act",
  "room.vote": "room:act",
  "room.giveUp": "room:act",
  "room.voteKick": "room:act",
  "account.info": "account:read",
  "notify": "notify",
  "storage.get": "storage",
  "storage.set": "storage",
  "storage.remove": "storage",
  "theme.set": "theme",
  "theme.clear": "theme",
  "net.fetch": "network",
  "rooms.enter": "rooms:join",
  "rooms.waitAndJoin": "rooms:join",
  "room.rehost": "rooms:join",
  "profile.open": "profile:read",
  "clipboard.write": "clipboard",
  "ui.dialog": "ui:dialog"
} as const satisfies Record<string, Permission>;

/** куда мод может добавить пункты меню */
export const menuTargets = ["room", "player", "roomSettings", "gameOver"] as const;
export type MenuTarget = typeof menuTargets[number];
export const isMenuTarget = (value: unknown): value is MenuTarget => menuTargets.includes(value as MenuTarget);

export type ModMethod = keyof typeof methodPermissions;

/** какое разрешение нужно, чтобы получать событие */
export const eventPermissions = {
  "chat:message": "chat:read",
  "room:message": "room:read",
  "room:state": "game:read",
  "screen:change": "game:read",
  "packet": "packet:read"
} as const satisfies Record<string, Permission>;

export type ModEvent = keyof typeof eventPermissions;

export const isModMethod = (name: unknown): name is ModMethod => typeof name == "string" && Object.hasOwn(methodPermissions, name);
export const isModEvent = (name: unknown): name is ModEvent => typeof name == "string" && Object.hasOwn(eventPermissions, name);
