import { createSignal } from "@common/ui";

/** поле пароля с кнопкой-глазком. `plain` - без подсказок менеджера паролей (скрытие через text-security) */
export function PasswordInput({ value = "", placeholder = "", autocomplete = "current-password", name, required, plain, autofocus, inputRef, onInput }: {
	value?: string, placeholder?: string, autocomplete?: string, name?: string, required?: boolean, plain?: boolean, autofocus?: boolean,
	inputRef?: (input: HTMLInputElement) => void, onInput?: (value: string) => void
}) @{
	const [shown, setShown] = createSignal(false);

	<>
		<style>
			.wrap { position: relative; display: flex; }
			input { flex: 1; min-width: 0; box-sizing: border-box; width: 100%; font-size: 16px; padding: 8px 40px 8px 10px; user-select: text; -webkit-user-select: text; }
			.eye { position: absolute; right: 2px; top: 50%; transform: translateY(-50%); width: 36px; height: 80%; padding: 0; background: none; border: none; font-size: 18px; line-height: 1; opacity: .7; cursor: pointer; }
		</style>
		<div class="wrap">
			<input ref={(element: HTMLInputElement) => inputRef?.(element)} type={plain ? "text" : shown() ? "text" : "password"} name={name} autocomplete={autocomplete} autocapitalize="off" spellcheck={false} placeholder={placeholder} value={value} required={required} autofocus={autofocus} style={plain && !shown() ? { "-webkit-text-security": "disc" } : undefined} onInput={(event) => onInput?.(event.currentTarget.value)} />
			<button type="button" class="eye" title={shown() ? "Скрыть пароль" : "Показать пароль"} aria-label={shown() ? "Скрыть пароль" : "Показать пароль"} onClick={() => setShown(!shown())}>{shown() ? "🙈" : "👁"}</button>
		</div>
	</>
}
