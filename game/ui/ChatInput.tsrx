import { createSignal, fromEvents, onCleanup, onMount } from "@common/ui";
import type { Assets } from "@common/assets";
import { isMobile } from "@common/utils/mobile";
import { expandMentionNumber, toggleMention } from "../domain/chat/message";
import type { Bafia } from "../domain/bafia";
import { GifPicker } from "./GifPicker.tsrx";
import { Icon } from "./Icon.tsrx";
import type { ChatController } from "./ChatView.tsrx";
import type { GameContext } from "../context";

const EMOJI = ["sm1", "sm2", "sm3", "sm4", "sm5", "sm6"];

export function ChatInput({ ctx, assets, send, expand, controller, bafia, history, placeholder = "Сообщение" }: {
	ctx: GameContext,
	assets: Assets, send: (text: string) => void, controller?: ChatController, placeholder?: string,
	bafia?: Bafia,
	history?: () => void,
	/** «@3 -> ник игрока #3 (в комнате) */
	expand?: (number: number) => string | undefined
}) @{
	let input!: HTMLInputElement;
	const [emojiOpen, setEmojiOpen] = createSignal(false);
	const [gifOpen, setGifOpen] = createSignal(false);
	const gifsOn = bafia ? fromEvents(bafia, "change", () => bafia.enabled) : () => false;
	const emoji = fromEvents(assets, "change", () => Object.fromEntries(EMOJI.map(name => [name, assets.url(`textures/emoji/${name}.png`)])) as Record<string, string>);

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
		input.focus();
		input.setSelectionRange(start + text.length, start + text.length);
	};
	if(controller) controller.mention = (username: string) => {
		if(!input) return;
		const result = toggleMention(input.value, input.selectionStart ?? input.value.length, username);
		input.value = result.value;
		// на телефоне фокус открыл бы клавиатуру на каждый ник: упоминание вставляем без фокуса
		if(!isMobile()) input.focus();
		input.setSelectionRange(result.caret, result.caret);
	};

	<>
		<style>
			.footer { flex: none; display: flex; align-items: center; gap: 6px; padding: 0 10px 5px; }
			.footer input { flex: 1; min-width: 0; padding: 8px 10px; }
			.icon-button { background: none !important; border: none; padding: 0; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
			.icon-button img { width: 30px; height: 30px; }
			.gif-button { flex: none; padding: 4px 6px; font-size: 12px; font-weight: 700; border-radius: 6px; }
			.emoji-panel { display: flex; flex-wrap: wrap; gap: 4px; padding: 0 10px 6px; }
			.emoji-panel img { width: 44px; height: 44px; cursor: pointer; }
		</style>
		@if (emojiOpen()) {
			<div class="emoji-panel">
				@for (const name of EMOJI) {
					<img src={emoji()[name]} alt={name} onClick={() => insert(":" + name + ":")} />
				}
			</div>
		}
		@if (bafia && gifsOn() && gifOpen()) {
			<GifPicker bafia={bafia!} pick={(id: string) => { setGifOpen(false); send("[gif:" + id + "]"); }} />
		}
		<div class="footer">
			<button class="icon-button" onClick={() => setEmojiOpen(!emojiOpen())} aria-label="Смайлики"><img src={emoji().sm1} alt="" /></button>
			@if (bafia && history && gifsOn()) {
				<button class="gif-button" onClick={history} aria-label="Отправить игру">{"Игра"}</button>
			}
			@if (bafia && gifsOn()) {
				<button class="gif-button" onClick={() => setGifOpen(!gifOpen())} aria-label="Гифки">{"GIF"}</button>
			}
			<input ref={input} type="text" placeholder={placeholder} onInput={onInput} onKeyDown={(event) => { if(event.key == "Enter") submit(); }} />
			<button class="icon-button" onClick={submit} aria-label="Отправить"><Icon name="send" color="black" size={30} /></button>
		</div>
	</>
}
