import type { ServerData } from "@common/protocol";
import Events from "@common/utils/emitter";
import { normalizeDecorations, type Decorations } from "./decorations";

export type DashboardUser = ServerData<"dashboard">["dashboard"]["user"];

/** игрок, под которым мы вошли. Экраны подписываются на `change` */
export class User extends Events<{ change: () => void }> {
  userObjectId = "";
  token = "";

  username = "";
  playerObjectId = "";
  photo = "";
  level = 0;
  experience = 0;
  nextLevelExperience = 0;
  previousLevelExperience = 0;
  vip = false;
  /** украшения: цвет, фон и тень ника, рамка фото */
  decorations?: Decorations;
  goldCoins = 0;
  silverCoins = 0;
  serverLanguage = "";
  playedGames = 0;
  matchMakingScore = 0;
  /** входящих заявок в друзья и непрочитанных личных сообщений (из дашборда) */
  friendRequests = 0;
  newMessages = 0;
  winsAsKiller = 0;
  winsAsMafia = 0;
  winsAsPeaceful = 0;

  get isSignedIn() { return !!this.token; }

  applyDashboard({ user, coins, friendshipRequests, newMessages, decorations }: ServerData<"dashboard">["dashboard"]) {
    this.decorations = normalizeDecorations(decorations);
    this.username = user.username ?? this.username;
    this.playerObjectId = user.playerObjectId ?? this.playerObjectId;
    this.photo = user.photo ?? this.photo;
    this.level = user.level ?? 0;
    this.experience = user.experience ?? 0;
    this.nextLevelExperience = user.nextLevelExperience ?? 0;
    this.previousLevelExperience = user.previousLevelExperience ?? 0;
    this.vip = !!user.vip;
    this.serverLanguage = user.serverLanguage ?? "";
    this.playedGames = user.playedGames ?? 0;
    this.matchMakingScore = user.matchMakingScore ?? 0;
    this.friendRequests = friendshipRequests ?? 0;
    this.newMessages = newMessages ?? 0;
    this.winsAsKiller = user.winsAsKiller ?? 0;
    this.winsAsMafia = user.winsAsMafia ?? 0;
    this.winsAsPeaceful = user.winsAsPeaceful ?? 0;
    this.goldCoins = coins?.gold ?? 0;
    this.silverCoins = coins?.silver ?? 0;
    this.emit("change");
  }

  /** монеты после покупки или пополнения (приходят в ответах магазина) */
  setCoins(gold: number | undefined, silver: number | undefined) {
    if(gold !== undefined) this.goldCoins = gold;
    if(silver !== undefined) this.silverCoins = silver;
    this.emit("change");
  }

  setPhoto(photo: string) {
    this.photo = photo;
    this.emit("change");
  }

  setUsername(username: string) {
    this.username = username;
    this.emit("change");
  }

  signIn(userObjectId: string, token: string) {
    this.userObjectId = userObjectId;
    this.token = token;
    this.emit("change");
  }

  signOut() {
    this.userObjectId = this.token = "";
    this.emit("change");
  }
}
