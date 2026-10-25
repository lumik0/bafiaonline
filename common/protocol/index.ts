export { encode, decode } from "./codec";
export type { ClientPacketName, ClientInput, ServerPacketName, ServerData, ServerMessage, Session } from "./codec";
export { ProtocolError } from "./define";
export { K } from "./keys";
export { BillingType } from "./client/market";
import { chatMessage } from "./server/chat";

/** сообщение чата из «сырого» вида (например, внутри статистики комнаты или сохранённой истории) */
export const parseChatMessage = (wire: unknown) => chatMessage.decode(wire, "message");
