import { createSignal, fromEvents, onCleanup, onMount } from "@common/ui";
import type { Assets } from "@common/assets";
import { isMobile } from "@common/utils/mobile";
import { expandMentionNumber, toggleMention } from "../domain/chat/message";
import type { Bafia } from "../domain/bafia";
import { ChatPanel } from "./ChatPanel.tsrx";
import { backspaceAt } from "./emoji-data";
import { Icon } from "./Icon.tsrx";
import type { ChatController } from "./ChatView.tsrx";
import type { GameContext } from "../context";

export function ChatInput({ ctx, assets, send, expand, controller, bafia, history, placeholder = "Сообщение" }: {
	ctx: GameContext,
	assets: Assets, send: (text: string) => void, controller?: ChatController, placeholder?: string,
	bafia?: Bafia,
	history?: () => void,
	/** «@3 -> ник игрока #3 (в комнате) */
	expand?: (number: number) => string | undefined
}) @{
	let input!: HTMLInputElement;
	// упоминание и смайлик на телефоне вставляются без фокуса, а iOS при нажатии на поле ставит курсор в начало: переносим его в конец
	let caretToEnd = false;
	const onFocus = () => {
		if(!caretToEnd) return;
		caretToEnd = false;
		const end = () => { if(document.activeElement === input) input.setSelectionRange(input.value.length, input.value.length); };
		setTimeout(end, 0);
		setTimeout(end, 60);
	};
	const [panelOpen, setPanelOpen] = createSignal(false);
	const [tab, setTab] = createSignal<"emoji" | "gif">("emoji");
	const gifsOn = bafia ? fromEvents(bafia, "change", () => bafia.enabled) : () => false;

	// Enter где угодно переводит курсор в поле сообщения (кроме других полей ввода и кнопок)
	onMount(() => {
		const keydown = (event: KeyboardEvent) => {
			const target = event.target;
			const control = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement || target instanceof HTMLSelectElement;
			if(event.key != "Enter" || control || !input?.isConnected || input.closest("[inert]")) return;
			// окно поверх экрана (подтверждение, профиль) не перебиваем
			if(input.getRootNode() !== document || document.querySelector("[role=dialog]")) return;
			event.preventDefault();
			input.focus();
		};
		document.addEventListener("keydown", keydown);
		onCleanup(() => document.removeEventListener("keydown", keydown));
	});

	const submit = () => {
		const value = input.value;
		if(!value.trim()) return;
		input.value = "";
		send(value);
	};
	const onInput = () => {
		if(!expand) return;
		const expanded = expandMentionNumber(input.value, expand);
		if(expanded === undefined) return;
		input.value = expanded;
		input.setSelectionRange(expanded.length, expanded.length);
	};
	const insert = (text: string) => {
		const start = input.selectionStart ?? input.value.length;
		input.value = input.value.slice(0, start) + text + input.value.slice(input.selectionEnd ?? start);
		// на телефоне фокус открыл бы клавиатуру поверх панели: смайлики вставляем без него
		if(!isMobile()) input.focus(); else caretToEnd = true;
		input.setSelectionRange(start + text.length, start + text.length);
	};
	const erase = () => {
		const caret = input.selectionStart ?? input.value.length;
		const result = backspaceAt(input.value, caret);
		input.value = result.text;
		input.setSelectionRange(result.caret, result.caret);
		if(!isMobile()) input.focus();
	};
	if(controller) controller.mention = (username: string) => {
		if(!input) return;
		const result = toggleMention(input.value, input.selectionStart ?? input.value.length, username);
		input.value = result.value;
		// на телефоне фокус открыл бы клавиатуру на каждый ник: упоминание вставляем без фокуса
		if(!isMobile()) input.focus(); else caretToEnd = true;
		input.setSelectionRange(result.caret, result.caret);
	};

	<>
		<style>
			.footer { flex: none; display: flex; align-items: center; gap: 6px; padding: 0 10px 5px; }
			.footer input { flex: 1; min-width: 0; padding: 8px 10px; }
			.icon-button { background: none !important; border: none; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #8a8f98; }
			.icon-button.on { color: var(--accent); }
			.gif-button { flex: none; padding: 4px 6px; font-size: 12px; font-weight: 700; border-radius: 6px; }
		</style>
		@if (panelOpen()) {
			<ChatPanel assets={assets} bafia={bafia} gifsOn={gifsOn} tab={tab} setTab={setTab} insert={insert} erase={erase} pickGif={(id: string) => { setPanelOpen(false); send("[gif:" + id + "]"); }} close={() => setPanelOpen(false)} />
		}
		<div class="footer">
			<button class={panelOpen() ? "icon-button on" : "icon-button"} onClick={() => setPanelOpen(!panelOpen())} aria-label="Смайлики и GIF"><Icon name="smile" size={26} /></button>
			@if (bafia && history && gifsOn()) {
				<button class="gif-button" onClick={history} aria-label="Отправить игру">{"Игра"}</button>
			}
			<input ref={input} type="text" onFocus={onFocus} placeholder={placeholder} onInput={onInput} onKeyDown={(event) => { if(event.key == "Enter") submit(); }} />
			<button class="icon-button" onMouseDown={(event) => event.preventDefault()} onClick={submit} aria-label="Отправить"><Icon name="send" color="black" size={24} /></button>
		</div>
	</>
}
