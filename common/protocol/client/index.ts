import { authPackets } from "./auth";
import { chatPackets } from "./chat";
import { friendsPackets } from "./friends";
import { lobbyPackets } from "./lobby";
import { marketPackets } from "./market";
import { matchmakingPackets, ratingPackets } from "./matchmaking";
import { profilePackets } from "./profile";
import { roomPackets } from "./room";

/** имя пакета (то, что пишем в `server.send("removePhoto")`) → схема */
export const clientPackets = {
  ...authPackets,
  ...profilePackets,
  ...marketPackets,
  ...ratingPackets,
  ...lobbyPackets,
  ...friendsPackets,
  ...chatPackets,
  ...roomPackets,
  ...matchmakingPackets
};
