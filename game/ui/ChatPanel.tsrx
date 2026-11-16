import { createSignal, fromEvents } from "@common/ui";
import type { Assets } from "@common/assets";
import type { Bafia } from "../domain/bafia";
import { EMOJI_GROUPS, loadRecentEmoji, rememberEmoji } from "./emoji-data";
import { GifPicker } from "./GifPicker.tsrx";
import { Icon } from "./Icon.tsrx";

const GAME_EMOJI = ["sm1", "sm2", "sm3", "sm4", "sm5", "sm6"];

/**
 * панель под полем ввода, как в Telegram: внизу вкладки «Эмодзи» и «GIF», сверху полоска разделов, посередине сетка
 * вид (скругление, высота кнопок) берётся из переменных платформы, поэтому на iOS, Android и ПК панель немного разная
 */
export function ChatPanel({ assets, bafia, gifsOn, tab, setTab, insert, erase, pickGif, close }: {
	assets: Assets,
	bafia?: Bafia,
	gifsOn: () => boolean,
	tab: () => "emoji" | "gif",
	setTab: (tab: "emoji" | "gif") => void,
	/** вставить текст в поле ввода */
	insert: (text: string) => void,
	/** стереть символ перед курсором */
	erase: () => void,
	pickGif: (id: string) => void,
	close: () => void
}) @{
	const images = fromEvents(assets, "change", () => Object.fromEntries(GAME_EMOJI.map(name => [name, assets.url(`textures/emoji/${name}.png`)])) as Record<string, string>);
	const [recent, setRecent] = createSignal(loadRecentEmoji());
	let scroller!: HTMLDivElement;
	const put = (emoji: string) => { insert(emoji); setRecent(rememberEmoji(emoji)); };
	const jump = (id: string) => scroller.querySelector(`[data-group="${id}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });

	<>
		<style>
			.sheet { flex: none; display: flex; flex-direction: column; height: min(300px, 42vh); margin: 0 0 4px; box-sizing: border-box; border-radius: var(--sheet-radius, 12px); background: var(--dialog-bg, #fff); color: var(--text-dark, #222); box-shadow: 0 -1px 0 rgba(128, 128, 128, .25); overflow: hidden; }
			.content { flex: 1; min-height: 0; display: flex; flex-direction: column; }
			.strip { flex: none; display: flex; gap: 2px; padding: 6px 8px 2px; overflow-x: auto; scrollbar-width: none; }
			.strip::-webkit-scrollbar { display: none; }
			.strip button { flex: none; width: 34px; height: 30px; padding: 0; display: flex; align-items: center; justify-content: center; background: transparent !important; border: none; border-radius: var(--chip-radius, 8px); font-size: 19px; opacity: .6; }
			.strip button img { width: 20px; height: 20px; }
			.strip button:active { opacity: 1; background: rgba(128, 128, 128, .2) !important; }
			.scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 0 8px 8px; overscroll-behavior: contain; }
			.title { position: sticky; top: 0; z-index: 1; padding: 8px 4px 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; opacity: .55; background: var(--dialog-bg, #fff); }
			.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(40px, 1fr)); }
			.grid button { padding: 0; height: 40px; display: flex; align-items: center; justify-content: center; background: transparent !important; border: none; border-radius: var(--chip-radius, 8px); font-size: 26px; line-height: 1; }
			.grid button img { width: 30px; height: 30px; }
			.grid button:active { background: rgba(128, 128, 128, .25) !important; transform: scale(.9); }
			@media (hover: hover) { .grid button:hover { background: rgba(128, 128, 128, .18) !important; } }
			.bottom { flex: none; display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-top: 1px solid rgba(128, 128, 128, .22); }
			.tabs { display: flex; gap: 2px; padding: 2px; border-radius: var(--chip-radius, 10px); background: rgba(128, 128, 128, .16); }
			.tabs button { padding: 5px 14px; border: none; border-radius: var(--chip-radius, 8px); background: transparent !important; color: inherit; font-size: 13px; font-weight: 600; opacity: .65; display: flex; align-items: center; gap: 6px; }
			.tabs button.on { opacity: 1; background: var(--dialog-bg, #fff) !important; box-shadow: 0 1px 3px rgba(0, 0, 0, .25); }
			.spacer { flex: 1; }
			.round { width: 34px; height: 34px; padding: 0 !important; display: flex; align-items: center; justify-content: center; border: none; border-radius: 50%; background: transparent !important; color: inherit; opacity: .7; }
			.round:active { background: rgba(128, 128, 128, .22) !important; }
		</style>
		<div class="sheet" data-keep>
			<div class="content">
				@if (tab() == "gif" && bafia) {
					<GifPicker bafia={bafia!} pick={pickGif} />
				} @else {
					<>
						<div class="strip">
							@if (recent().length) {
								<button aria-label="Недавние" onClick={() => jump("recent")}>{"🕒"}</button>
							}
							<button aria-label="Игровые" onClick={() => jump("game")}><img src={images().sm1} alt="" /></button>
							@for (const group of EMOJI_GROUPS) {
								<button aria-label={group.title} onClick={() => jump(group.id)}>{group.icon}</button>
							}
						</div>
						<div class="scroll" ref={scroller}>
							@if (recent().length) {
								<div data-group="recent">
									<div class="title">{"Недавние"}</div>
									<div class="grid">
										@for (const emoji of recent()) {
											<button onClick={() => put(emoji)}>{emoji}</button>
										}
									</div>
								</div>
							}
							<div data-group="game">
								<div class="title">{"Игровые"}</div>
								<div class="grid">
									@for (const name of GAME_EMOJI) {
										<button aria-label={name} onClick={() => insert(":" + name + ":")}><img src={images()[name]} alt="" /></button>
									}
								</div>
							</div>
							@for (const group of EMOJI_GROUPS) {
								<div data-group={group.id}>
									<div class="title">{group.title}</div>
									<div class="grid">
										@for (const emoji of group.items) {
											<button onClick={() => put(emoji)}>{emoji}</button>
										}
									</div>
								</div>
							}
						</div>
					</>
				}
			</div>
			<div class="bottom">
				<div class="tabs">
					<button class={tab() == "emoji" ? "on" : ""} onClick={() => setTab("emoji")}>{"Эмодзи"}</button>
					@if (bafia && gifsOn()) {
						<button class={tab() == "gif" ? "on" : ""} onClick={() => setTab("gif")}>{"GIF"}</button>
					}
				</div>
				<span class="spacer"></span>
				@if (tab() == "emoji") {
					<button class="round" aria-label="Стереть" onClick={erase}><Icon name="backspace" size={22} /></button>
				}
				<button class="round" aria-label="Закрыть панель" onClick={close}><Icon name="close" size={18} /></button>
			</div>
		</div>
	</>
}
