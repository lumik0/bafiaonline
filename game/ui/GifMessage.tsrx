import { createEffect, createSignal, fromEvents } from "@common/ui";
import type { GifItem } from "@common/bafia/protocol";
import type { Bafia } from "../domain/bafia";

/** гифка в сообщении (`[gif:номер]`); без согласия на сервер Бафии - пояснение */
export function GifMessage({ bafia, id }: { bafia: Bafia | undefined, id: string }) @{
	const [gif, setGif] = createSignal<GifItem | null | undefined>(undefined);
	const [broken, setBroken] = createSignal(false);
	const state = bafia ? fromEvents(bafia, "change", () => ({ enabled: bafia.enabled, ready: bafia.ready })) : () => ({ enabled: false, ready: false });

	const favorite = bafia ? fromEvents(bafia, "change", () => bafia.isFavorite(id)) : () => false;
	// готовый адрес из кэша: гифка начинает скачиваться сразу, а пока её нет - заглушка того же размера, что и гифка
	const [src, setSrc] = createSignal("");

	createEffect(() => {
		const { enabled, ready } = state();
		if(!bafia || !enabled || !ready) return;
		void bafia.gif(id).then(item => {
			setGif(item);
			if(item) void bafia.images.load(item.url).then(setSrc);
		});
	});

	<>
		<style>
			.note { opacity: .7; font-style: italic; }
			.gif { display: block; margin: 4px 0; border-radius: 8px; }
			.box { position: relative; display: inline-block; }
			.fav { position: absolute; top: 8px; right: 6px; padding: 0 6px; line-height: 1.5; border-radius: 999px; background: rgba(0, 0, 0, .45); color: #fff; font-size: 15px; opacity: .75; }
			.fav.on { color: #ffd54a; opacity: 1; }
			.wait { display: block; margin: 4px 0; width: 160px; height: 110px; border-radius: 8px; background: rgba(128, 128, 128, .25); animation: gifwait 1.2s ease-in-out infinite; }
			@keyframes gifwait { 50% { opacity: .45; } }
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
						@if (src()) {
							<span class="box">
							<img class="gif" src={src()} alt={gif()!.title} title={gif()!.title} referrerpolicy="no-referrer" style={{ width: "auto", height: "auto", "max-width": "220px", "max-height": "180px" }} onError={() => setBroken(true)} />
							<button class={favorite() ? "fav on" : "fav"} title={favorite() ? "Убрать из избранного" : "В избранное"} onClick={() => bafia!.toggleFavorite(id, gif()?.title ?? "")}>{favorite() ? "★" : "☆"}</button>
							</span>
						} @else {
							<span class="wait" title="Гифка загружается"></span>
						}
					}
				} @else {
					@if (gif() === null) {
						<span class="note">{"[такой гифки нет]"}</span>
					} @else {
						<span class="wait" title="Гифка загружается"></span>
					}
				}
			}
		}
	</>
}
