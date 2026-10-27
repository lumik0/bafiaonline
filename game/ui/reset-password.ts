import { ConnectionError, RequestTimeoutError } from "@common/net";
import { formatDuration } from "@common/utils/format";
import type { GameContext } from "../context";
import { requestPasswordReset } from "../domain/auth";

/** спрашивает почту, отправляет письмо для смены пароля и сообщает, что вышло */
export async function resetPassword(ctx: Pick<GameContext, "client" | "dialogs">, initial = ""): Promise<void> {
  const email = (await ctx.dialogs.prompt({
    title: "СМЕНА ПАРОЛЯ", text: "Пришлём письмо со ссылкой для смены пароля.\nВведи почту аккаунта", initial, placeholder: "mail@example.com", ok: "Отправить",
    validate: value => /^\S+@\S+\.\S+$/.test(value.trim()) ? undefined : "Введи почту"
  }))?.trim();
  if(!email) return;

  try {
    const result = await requestPasswordReset(ctx.client, email);
    if(result.status == "sent") await ctx.dialogs.alert(`Письмо отправлено на ${email}.\nОткрой ссылку из него, чтобы сменить пароль. Если письма нет, посмотри папку «Спам».`, { title: "Готово" });
    else if(result.status == "noUser") await ctx.dialogs.alert("Пользователя с такой почтой нет", { title: "Не найдено" });
    else await ctx.dialogs.alert(`Слишком часто. Попробуй ещё раз${result.seconds ? " через " + formatDuration(result.seconds) : " позже"}`, { title: "Подожди" });
  } catch(error) {
    if(error instanceof ConnectionError || error instanceof RequestTimeoutError) await ctx.dialogs.alert("Сервер не ответил. Попробуй ещё раз", { title: "Ошибка" });
    else throw error;
  }
}
