import { ProtocolError, encodeShape, decodeShape, isObject, type Infer, type ClientPacket, type ServerPacket } from "./define";
import { clientPackets } from "./client";
import { serverPackets } from "./server";
import { K } from "./keys";

export type ClientPacketName = keyof typeof clientPackets;
export type ServerPacketName = keyof typeof serverPackets;

type ShapeOf<P> = P extends ClientPacket<infer S> | ServerPacket<infer S> ? S : never;

/** данные, которые нужно передать в `send(name, input)` */
export type ClientInput<N extends ClientPacketName> = Infer<ShapeOf<(typeof clientPackets)[N]>>;
/** данные пришедшего пакета */
export type ServerData<N extends ServerPacketName> = Infer<ShapeOf<(typeof serverPackets)[N]>>;

export type ServerMessage = {
  [N in ServerPacketName]: { name: N, data: ServerData<N>, raw: Record<string, unknown> }
}[ServerPacketName] | { name: "unknown", type: string | undefined, data: Record<string, unknown>, raw: Record<string, unknown> };

export interface Session {
  userObjectId: string
  token: string
}

export function encode<N extends ClientPacketName>(name: N, input: ClientInput<N>, session?: Session): string {
  const packet: ClientPacket = clientPackets[name];
  const wire: Record<string, unknown> = { [K.TYPE]: packet.type, ...encodeShape(packet.shape, input as Record<string, unknown>) };

  if(packet.auth) {
    if(!session) throw new Error(`Пакет ${name} требует авторизации`);
    wire[K.USER_OBJECT_ID] = session.userObjectId;
    wire[K.TOKEN] = session.token;
  }

  return JSON.stringify(wire);
}

const serverByType = new Map<string | null, [ServerPacketName, ServerPacket]>();
for(const [name, packet] of Object.entries(serverPackets) as [ServerPacketName, ServerPacket][]) {
  if(serverByType.has(packet.type)) throw new Error(`Два входящих пакета с одним типом "${packet.type}": ${name}`);
  serverByType.set(packet.type, [name, packet]);
}

/** бросает ProtocolError, если пакет известен, но не соответствует схеме; JSON.parse бросает на мусоре */
export function decode(text: string): ServerMessage {
  const raw: unknown = JSON.parse(text);
  if(!isObject(raw)) throw new ProtocolError("packet", "object", raw);

  const type = typeof raw[K.TYPE] == "string" ? raw[K.TYPE] as string : null;
  const known = serverByType.get(type);

  // {t: 5} без ty - таймер; другие пакеты без ty нам неизвестны
  if(!known || (type === null && typeof raw[K.TIMER] != "number")) {
    return { name: "unknown", type: type ?? undefined, data: raw, raw };
  }

  const [name, packet] = known;
  return { name, data: decodeShape(packet.shape, raw, name), raw } as ServerMessage;
}
