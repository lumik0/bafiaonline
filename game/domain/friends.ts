import type { ServerClient } from "@common/net";
import type { ServerData } from "@common/protocol";
import { normalizeDecorations, type Decorations } from "./decorations";

export interface FriendItem {
  /** id дружбы: открывает личный чат; у результатов поиска нет */
  friendshipId?: string
  playerObjectId: string
  username: string
  photo?: string
  isOnline: boolean
  /** когда игрок последний раз был в сети (мс); у поиска нет */
  updated?: number
  newMessages: number
  /** входящая заявка, ждёт вашего ответа */
  incoming: boolean
  roomId?: string
  decorations?: Decorations
}

type Entry = ServerData<"friendshipList">["list"]["entries"][number];
type SearchUser = ServerData<"searchResults">["users"][number];

export function toFriendItem(entry: Entry): FriendItem | undefined {
  const user = entry.friend ?? entry.user;
  if(!user?.playerObjectId) return undefined;
  const room = entry.room as { o?: unknown } | undefined;

  return {
    friendshipId: entry.id,
    playerObjectId: user.playerObjectId,
    username: user.username ?? "",
    photo: user.photo,
    isOnline: !!user.isOnline,
    updated: entry.updated,
    newMessages: entry.newMessages ?? 0,
    incoming: entry.accepted === 0,
    roomId: typeof room?.o == "string" ? room.o : undefined,
    decorations: normalizeDecorations(user.decorations)
  };
}

export function toSearchItem(user: SearchUser): FriendItem | undefined {
  if(!user.playerObjectId) return undefined;
  return { playerObjectId: user.playerObjectId, username: user.username ?? "", photo: user.photo, isOnline: !!user.isOnline, newMessages: 0, incoming: false, decorations: normalizeDecorations(user.decorations) };
}

const compact = <T>(items: (T | undefined)[]) => items.filter((item): item is T => item !== undefined);

/** id игрока вместо ника (вида 4cedea70-ad2d-4c24-b650-dabfebfaddb3 или 24 шестнадцатеричных знака): в поиске сразу открывается профиль */
export const looksLikeId = (text: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text) || /^[0-9a-f]{24}$/i.test(text);

/** друг в окне «Пригласить в комнату» */
export interface InviteItem {
  playerObjectId: string
  username: string
  photo?: string
  isOnline: boolean
  invited: boolean
  decorations?: Decorations
}

type InviteEntry = ServerData<"inviteList">["friends"][number];

export function toInviteItem(entry: InviteEntry): InviteItem | undefined {
  if(!entry.playerObjectId) return undefined;
  return { playerObjectId: entry.playerObjectId, username: entry.username ?? "", photo: entry.photo, isOnline: !!entry.isOnline, invited: !!entry.invited, decorations: normalizeDecorations(entry.decorations) };
}

/** друзья, заявки и поиск игроков */
export class Friends {
  constructor(private client: ServerClient) {}

  async friends(): Promise<FriendItem[]> {
    const answer = await this.client.request("addClientToFriendsList", {}, "friendshipList");
    return compact(answer.data.list.entries.map(toFriendItem));
  }

  /** заявки: и ваши отправленные, и входящие (у них `incoming`) */
  async requests(): Promise<FriendItem[]> {
    const answer = await this.client.request("getSentFriendRequests", {}, "friendshipList");
    return compact(answer.data.list.entries.map(toFriendItem));
  }

  async search(text: string): Promise<FriendItem[]> {
    const answer = await this.client.request("searchUser", { text }, "searchResults");
    return compact(answer.data.users.map(toSearchItem));
  }

  /** друзья, которых можно позвать в текущую комнату; сначала те, кто в сети */
  async inviteList(): Promise<InviteItem[]> {
    const answer = await this.client.request("getInviteList", {}, "inviteList");
    return compact(answer.data.friends.map(toInviteItem)).sort((a, b) => Number(b.isOnline) - Number(a.isOnline));
  }

  /** отправить приглашение; `vip` - приглашать друзей может только VIP */
  async invite(playerObjectId: string): Promise<"ok" | "vip"> {
    const answer = await this.client.request("inviteFriend", { playerObjectId }, ["friendInvited", "inviteNeedsVip"]);
    return answer.name == "friendInvited" ? "ok" : "vip";
  }
}
