import { createEffect, createSignal, fromEvents } from "@common/ui";
import type { GifItem } from "@common/bafia/protocol";
import type { Bafia } from "../domain/bafia";

/** гифка в сообщении (`[gif:номер]`); без согласия на сервер Бафии - пояснение */
export function GifMessage({ bafia, id }: { bafia: Bafia | undefined, id: string }) @{
	const [gif, setGif] = createSignal<GifItem | null | undefined>(undefined);
	const [broken, setBroken] = createSignal(false);
	const state = bafia ? fromEvents(bafia, "change", () => ({ enabled: bafia.enabled, ready: bafia.ready })) : () => ({ enabled: false, ready: false });

	createEffect(() => {
		const { enabled, ready } = state();
		if(!bafia || !enabled || !ready) return;
		void bafia.gif(id).then(setGif);
	});

	<>
		<style>
			.note { opacity: .7; font-style: italic; }
			.gif { display: block; margin: 4px 0; border-radius: 8px; }
		</style>
		@if (!bafia) {
			<span>{"[gif:" + id + "]"}</span>
		} @else {
			@if (!state().enabled) {
				<span class="note">{"[гифка скрыта: ты не согласился на сервер Бафии, включи его в настройках]"}</span>
			} @else {
				@if (gif()) {
					@if (broken()) {
						<span class="note">{"[гифка не загрузилась]"}</span>
					} @else {
						<img class="gif" src={gif()!.url} alt={gif()!.title} title={gif()!.title} loading="lazy" referrerpolicy="no-referrer" style={{ width: "auto", height: "auto", "max-width": "220px", "max-height": "180px" }} onError={() => setBroken(true)} />
					}
				} @else {
					<span class="note">{gif() === null ? "[такой гифки нет]" : "[гифка загружается…]"}</span>
				}
			}
		}
	</>
}
