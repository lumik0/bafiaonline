import type { ServerClient } from "@common/net";
import type { ServerData } from "@common/protocol";
import type { Accounts } from "@common/storage";
import { RequestTimeoutError } from "@common/net";
import type { User } from "./user";

export type PlayerProfile = ServerData<"userProfile">["profile"];

export type UsernameResult =
  | { status: "ok", username: string }
  | { status: "wrongSymbols" | "exists" | "outOfBounds" | "empty" };

export type FriendResult = { status: "ok" } | { status: "listFull", limit: number };

export type LanguageResult = { status: "ok" } | { status: "tooSoon", waitSeconds: number };

export const usernameProblems: Record<Exclude<UsernameResult["status"], "ok">, string> = {
  wrongSymbols: "Для никнейма можно использовать только символы 0-9, а-Я, a-Z",
  exists: "Этот никнейм уже занят",
  outOfBounds: "Никнейм слишком короткий или длинный.\nОн должен состоять из 3–12 символов",
  empty: "Никнейм не может быть пустым"
};

/** мужские (m1, m2…) раньше женских (f1…), внутри - по номеру */
export function sortDefaultPhotos(ids: readonly string[]): string[] {
  return [...ids].sort((a, b) => {
    if(a[0] != b[0]) return a[0] == "m" ? -1 : 1;
    return Number(a.slice(1)) - Number(b.slice(1));
  });
}

/** действия над профилем: фото, ник, язык, чужие профили и дружба */
export class ProfileService {
  constructor(private client: ServerClient, private user: User, private accounts: Accounts) {}

  async defaultPhotos(): Promise<string[]> {
    const answer = await this.client.request("getDefaultPhotos", {}, "defaultPhotos");
    return sortDefaultPhotos(answer.data.photos.ids);
  }

  async chooseDefaultPhoto(id: string) {
    await this.client.request("setDefaultPhoto", { photo: id, playerObjectId: this.user.playerObjectId }, "defaultPhotoSet");
    this.user.setPhoto(id);
    await this.saveAccountPhoto(id);
  }

  /** photoBase64 - JPEG без префикса data: */
  async uploadPhoto(photoBase64: string): Promise<"ok" | "wrongType"> {
    const answer = await this.client.request("uploadPhoto", { file: photoBase64 }, ["dashboard", "wrongFileType"]);
    if(answer.name == "wrongFileType") return "wrongType";
    await this.applyPhoto(answer.data.dashboard.user.photo);
    return "ok";
  }

  async removePhoto() {
    const answer = await this.client.request("removePhoto", {}, ["dashboard", "photoRemoved"]);
    await this.applyPhoto(answer.name == "dashboard" ? answer.data.dashboard.user.photo : undefined);
  }

  async setUsername(username: string): Promise<UsernameResult> {
    const answer = await this.client.request("setUsername", { username }, ["usernameSet", "usernameWrongSymbols", "usernameExists", "usernameOutOfBounds", "usernameEmpty"]);
    switch(answer.name) {
      case "usernameSet": {
        const name = answer.data.username ?? username;
        this.user.setUsername(name);
        await this.accounts.upsert({ userId: this.user.userObjectId, name });
        return { status: "ok", username: name };
      }
      case "usernameWrongSymbols": return { status: "wrongSymbols" };
      case "usernameExists": return { status: "exists" };
      case "usernameOutOfBounds": return { status: "outOfBounds" };
      case "usernameEmpty": return { status: "empty" };
    }
  }

  async setServerLanguage(language: "ru" | "en"): Promise<LanguageResult> {
    const answer = await this.client.request("setServerLanguage", { language }, ["serverLanguageSet", "serverLanguageTimeError"]);
    if(answer.name == "serverLanguageTimeError") return { status: "tooSoon", waitSeconds: answer.data.time };
    this.user.serverLanguage = language;
    return { status: "ok" };
  }

  /** `undefined`, если сервер не ответил (игрок вышел, скрыл профиль) */
  async loadProfile(playerObjectId: string, timeout = 5000): Promise<PlayerProfile | undefined> {
    try {
      return (await this.client.request("getUserProfile", { playerObjectId }, "userProfile", { timeout })).data.profile;
    } catch(error) {
      if(error instanceof RequestTimeoutError) return undefined;
      throw error;
    }
  }

  /** свой пол из профиля: 0 - мужской, 1 - женский; `undefined`, если сервер не ответил */
  async mySex(): Promise<number | undefined> {
    return (await this.loadProfile(this.user.playerObjectId))?.user.sex;
  }

  /**
   * сменить пол; ответа на пакет нет, профиль перечитывается
   * (до трёх проверок); `true` - сервер принял
   */
  async setSex(sex: number, wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))): Promise<boolean> {
    this.client.send("setSex", { sex });
    for(let attempt = 0; attempt < 3; attempt++) {
      await wait(500);
      if(await this.mySex() === sex) return true;
    }
    return false;
  }

  /** отправить заявку или принять входящую: для сервера это один и тот же пакет */
  async addFriend(playerObjectId: string): Promise<FriendResult> {
    const answer = await this.client.request("addFriend", { userObjectId: playerObjectId }, ["friendAdded", "friendshipListFull"]);
    return answer.name == "friendshipListFull" ? { status: "listFull", limit: answer.data.limit } : { status: "ok" };
  }

  /** отменить заявку или удалить из друзей */
  async removeFriend(playerObjectId: string) {
    await this.client.request("removeFriend", { userObjectId: playerObjectId }, "friendRemoved");
  }

  private async applyPhoto(photo: string | undefined) {
    this.user.setPhoto(photo || "1");
    await this.saveAccountPhoto(this.user.photo);
  }

  private async saveAccountPhoto(photo: string) {
    if(this.user.userObjectId) await this.accounts.upsert({ userId: this.user.userObjectId, photo });
  }
}
