import type { ServerClient } from "@common/net";
import type { Account, Accounts } from "@common/storage";
import { md5salt } from "@common/utils/md5";
import Events from "@common/utils/emitter";
import { formatDuration } from "@common/utils/format";
import { languageCode } from "./market";
import type { User } from "./user";

/** вход всегда по почте и паролю: по токену не входим, поэтому пароль хранится в аккаунте */
export interface Credentials {
  email: string
  password: string
}

export type SignInResult =
  | { status: "ok", account: Account }
  | { status: "error", code: number, message: string }
  | { status: "blocked", reason?: string, secondsRemaining?: number }
  | { status: "inactive", secondsRemaining?: number }
  | { status: "emailNotVerified" };

/** тексты ошибок входа; код приходит от сервера */
export const signInErrorMessages: Record<number, string> = {
  [-9]: "Капча не пройдена",
  [-8]: "Нет данных аккаунта",
  [-7]: "Повтори позже",
  [-6]: "Ошибка проверки почты",
  [-5]: "Ошибка входа в Google",
  [-4]: "Сессия неактивна",
  [-3]: "Неверный пароль",
  [-1]: "Аккаунт не зарегистрирован",
  [0]: "Логин и пароль нужны"
};

export const signInErrorMessage = (code: number) => signInErrorMessages[code] ?? "Неизвестная ошибка";

/** текст для игрока по неудачному результату входа; для успешного `undefined` */
export function signInProblem(result: SignInResult): string | undefined {
  switch(result.status) {
    case "ok": return undefined;
    case "error": return `${result.message}\nКод ошибки: ${result.code}`;
    case "blocked": return `Ты был заблокирован по причине [${result.reason ?? "не указана"}]${result.secondsRemaining ? `\n\nОставшееся время блокировки: ${formatDuration(result.secondsRemaining)}` : ""}`;
    case "inactive": return `Ты был неактивен${result.secondsRemaining ? `\n\nОставшееся время блокировки: ${formatDuration(result.secondsRemaining)}` : ""}`;
    case "emailNotVerified": return "Ты не подтвердил свой email.\nПроверь почту (и папку «Спам») и следуй инструкции в письме.";
  }
}

/** новый при каждом входе: сервер не связывает входы с одним устройством */
function deviceId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), byte => byte.toString(16).padStart(2, "0")).join("");
}

export class Auth extends Events<{ signedIn: (account: Account, reconnected: boolean) => void, signedOut: () => void, blocked: (email: string, secondsRemaining: number) => void, restoreFailed: (email: string, result: SignInResult) => void }> {
  private current?: Credentials;
  /** в комнате не запрашивать дашборд при входе: иначе подписка переключится и игра встанет */
  keepSubscription?: () => boolean;

  constructor(private client: ServerClient, private accounts: Accounts, private user: User) {
    super();
    // после обрыва связи сервер забыл нас - входим заново
    client.on("open", () => void this.restore());
  }

  async signIn(credentials: Credentials): Promise<SignInResult> {
    const result = await this.authenticate(credentials);
    if(result.status == "ok") this.emit("signedIn", result.account, false);
    return result;
  }

  signOut() {
    this.current = undefined;
    this.client.session = undefined;
    this.user.signOut();
    this.emit("signedOut");
  }

  private async restore() {
    if(!this.current) return;
    try {
      const result = await this.authenticate(this.current, !this.keepSubscription?.());
      if(result.status == "ok") this.emit("signedIn", result.account, true);
      else {
        // сервер больше не пускает (бан, смена пароля): без этого игрок остался бы на экране без входа
        const { email } = this.current;
        this.signOut();
        this.emit("restoreFailed", email, result);
      }
    } catch {
      // связь опять пропала - следующий open повторит попытку
    }
  }

  private async authenticate(credentials: Credentials, loadDashboard = true): Promise<SignInResult> {
    const expect = ["signedIn", "signInError", "userBlocked", "userInactiveBlocked", "emailNotVerified"] as const;
    const message = await this.client.request("signInWithPassword", {
      email: credentials.email,
      password: md5salt(credentials.password),
      captcha: "",
      source: "browser",
      deviceId: deviceId()
    }, expect);

    switch(message.name) {
      case "signInError":
        return { status: "error", code: message.data.error, message: signInErrorMessage(message.data.error) };
      case "userBlocked":
        if(message.data.secondsRemaining) this.emit("blocked", credentials.email, message.data.secondsRemaining);
        return { status: "blocked", reason: message.data.reason, secondsRemaining: message.data.secondsRemaining };
      case "userInactiveBlocked":
        if(message.data.secondsRemaining) this.emit("blocked", credentials.email, message.data.secondsRemaining);
        return { status: "inactive", secondsRemaining: message.data.secondsRemaining };
      case "emailNotVerified":
        return { status: "emailNotVerified" };
    }

    const { userObjectId, token } = message.data.user;
    this.client.session = { userObjectId, token };
    this.user.signIn(userObjectId, token);
    this.current = credentials;

    if(loadDashboard) {
      const dashboard = await this.client.request("addClientToDashboard", {}, "dashboard");
      this.user.applyDashboard(dashboard.data.dashboard);
    }

    const { account } = await this.accounts.upsert({
      name: this.user.username,
      email: credentials.email,
      password: credentials.password,
      token,
      userId: userObjectId,
      playerUserId: this.user.playerObjectId,
      photo: this.user.photo
    });
    return { status: "ok", account };
  }
}

export type PasswordResetResult =
  | { status: "sent" }
  | { status: "noUser" }
  | { status: "tooOften", seconds?: number };

/** письмо со ссылкой для смены пароля на почту аккаунта; вход в аккаунт не нужен */
export async function requestPasswordReset(client: ServerClient, email: string): Promise<PasswordResetResult> {
  const reply = await client.request("resetPassword", { email, language: languageCode() }, ["passwordResetSent", "passwordResetNoUser", "passwordResetTooOften"]);
  switch(reply.name) {
    case "passwordResetSent": return { status: "sent" };
    case "passwordResetNoUser": return { status: "noUser" };
    default: return { status: "tooOften", seconds: reply.data.seconds };
  }
}
