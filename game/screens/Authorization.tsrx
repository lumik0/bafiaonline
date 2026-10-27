import { createSignal } from "@common/ui";
import { AppBar } from "../ui/AppBar.tsrx";

/** вход по почте и паролю. submit возвращает текст ошибки или undefined, если вошли */
export function Authorization({ email = "", error = "", submit, forgot }: { email?: string, error?: string, submit: (email: string, password: string) => Promise<string | undefined>, forgot?: (email: string) => void }) @{
	const [message, setMessage] = createSignal(error);
	const [pending, setPending] = createSignal(false);
	let emailInput!: HTMLInputElement, passwordInput!: HTMLInputElement;

	const send = async (event: Event) => {
		event.preventDefault();
		if(pending()) return;
		setPending(true);
		setMessage("");
		setMessage((await submit(emailInput.value.trim(), passwordInput.value)) ?? "");
		setPending(false);
	};

	<>
		<style>
			.page { display: flex; flex-direction: column; height: 100%; }
			form { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 12px; padding: 24px; max-width: 400px; width: 100%; box-sizing: border-box; margin: 0 auto; }
			input { padding: 40px 12px; font-size: 16px; user-select: text; -webkit-user-select: text; }
			.error { white-space: pre-wrap; color: #ff9a9a; font-size: 14px; min-height: 18px; }
			button { padding: 10px; font-size: 16px; }
			.link { background: none; border: none; text-decoration: underline; font-size: 14px; opacity: .8; }
			.hint { font-size: 12px; opacity: .6; text-align: center; }
		</style>
		<div class="page">
			<AppBar title="Вход" />
			<form onSubmit={send}>
				<input ref={emailInput} type="text" placeholder="Почта или логин" autocomplete="username" autocapitalize="off" spellcheck={false} value={email} required />
				<input ref={passwordInput} type="password" placeholder="Пароль" autocomplete="current-password" required />
				<div class="error">{message()}</div>
				<button type="submit" disabled={pending()}>{pending() ? "Входим…" : "Войти"}</button>
				@if (forgot) {
					<button type="button" class="link" onClick={() => forgot(emailInput.value.trim())}>{"Забыли пароль?"}</button>
				}
				<div class="hint">{"Регистрация: напиши @bafiaonlinebot"}</div>
			</form>
		</div>
	</>
}
