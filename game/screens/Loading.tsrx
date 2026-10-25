import { createSignal, fromEvents } from "@common/ui";
import type { Assets } from "@common/assets";
import { createPicker } from "../domain/loading";
import { AppBar } from "../ui/AppBar.tsrx";

const EMOJI = ["HZ", "I3", "Nf", "dy", "j4", "sad"]; //"sm1", "sm2", "sm3", "sm4", "sm5", "sm6"];

/** экран ожидания: смайлики сменяют друг друга; при долгом молчании сервера - кнопка с новостями */
export function Loading({ text, assets, down }: { text: () => string, assets: Assets, down: () => boolean }) @{
	const urls = fromEvents(assets, "change", () => EMOJI.map(name => assets.url(`textures/emoji/${name}.png`)));
	const picker = createPicker(EMOJI.length);
	const [index, setIndex] = createSignal(picker.next());

	/** смайлик меняется, когда прозрачность дошла до нуля: смену не видно. Подряд один и тот же не выпадает */
	const next = () => setIndex(picker.next());

	<>
		<style>
			.page { display: flex; flex-direction: column; height: 100%; }
			.loading { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 0 20px; text-align: center; white-space: pre-line; }
			.emoji { width: 56px; height: 56px; object-fit: contain; opacity: 0; animation: breathe 2.2s ease-in-out infinite; }
			@keyframes breathe { 0%, 100% { opacity: 0; transform: scale(.85); } 50% { opacity: 1; transform: scale(1.08); } }
			@media (prefers-reduced-motion: reduce) { .emoji { animation: none; opacity: 1; } }
		</style>
		<div class="page">
			<AppBar title="Бафия онлайн" />
			<div class="loading">
				<img class="emoji" src={urls()[index()]} alt="" onAnimationIteration={next} />
				<div>{text()}</div>
				@if (down()) {
					<button onClick={() => void window.open("https://t.me/bafiaonline", "_blank", "noopener")}>{"Новости в Telegram"}</button>
				}
			</div>
		</div>
	</>
}
