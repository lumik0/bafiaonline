import { createSignal } from "@common/ui";

/** ввод одной строки. `validate` возвращает текст ошибки - окно тогда остаётся открытым */
export function PromptContent({ text, initial = "", placeholder = "", ok, cancel, validate, submit }: {
	text?: string, initial?: string, placeholder?: string, ok: string, cancel: string,
	validate?: (value: string) => string | undefined, submit: (value: string | undefined) => void
}) @{
	const [error, setError] = createSignal("");
	let input: HTMLInputElement;

	const accept = (event: Event) => {
		event.preventDefault();
		const problem = validate?.(input.value);
		if(problem) setError(problem);
		else submit(input.value);
	};

	<>
		<style>
			form { display: flex; flex-direction: column; gap: 10px; }
			.text { white-space: pre-wrap; font-size: 14px; line-height: 1.45; }
			input { font-size: 16px; padding: 8px 10px; user-select: text; -webkit-user-select: text; }
			.error { color: #ff9a9a; font-size: 13px; min-height: 16px; }
			.buttons { display: flex; gap: 8px; justify-content: flex-end; }
		</style>
		<form onSubmit={accept}>
			@if (text) {
				<div class="text">{text}</div>
			}
			<input ref={input} value={initial} placeholder={placeholder} autofocus />
			<div class="error">{error()}</div>
			<div class="buttons">
				@if (cancel) {
					<button type="button" onClick={() => submit(undefined)}>{cancel}</button>
				}
				<button type="submit">{ok}</button>
			</div>
		</form>
	</>
}
