import { createSignal, fromEvents, onMount } from "@common/ui";
import type { GameContext } from "../../context";

/** одна гифка из избранного: превью грузится само, нажатие выбирает её */
function PinItem({ ctx, id, title, on, choose }: { ctx: GameContext, id: string, title: string, on: boolean, choose: () => void }) @{
	const [src, setSrc] = createSignal("");
	onMount(() => void ctx.bafia.gif(id).then(item => { if(item) void ctx.bafia.images.load(item.url).then(setSrc); }));
	<>
		<button class={on ? "item on" : "item"} onClick={choose} title={title || id}>
			@if (src()) {
				<img src={src()} alt="" referrerpolicy="no-referrer" />
			} @else {
				<span class="wait"></span>
			}
		</button>
	</>
}

/** выбор закреплённой гифки из избранных: сетка превью вместо выпадающего списка */
export function PinPicker({ ctx, current, choose, close }: { ctx: GameContext, current?: string, choose: (id: string | undefined) => void, close: () => void }) @{
	const list = fromEvents(ctx.bafia, "change", () => ctx.bafia.favorites);
	const pick = (id: string | undefined) => { choose(id); close(); };
	<>
		<style>
			.hint { margin: 0 0 10px; font-size: 13px; opacity: .8; }
			.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; max-height: 50vh; overflow-y: auto; }
			.item { padding: 0; height: 80px; border-radius: 8px; overflow: hidden; background: rgba(128, 128, 128, .22); border: 2px solid transparent; }
			.item.on { border-color: var(--accent); }
			.item img, .item .wait { display: block; width: 100%; height: 100%; object-fit: cover; }
			.wait { animation: pinwait 1.2s ease-in-out infinite; }
			@keyframes pinwait { 50% { opacity: .45; } }
			.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
		</style>
		@if (list().length) {
			<>
				<p class="hint">{"Выбери гифку из избранных: она будет закреплена в твоём профиле."}</p>
				<div class="grid">
					@for (const item of list()) {
						<PinItem ctx={ctx} id={item.id} title={item.title} on={current == item.id} choose={() => pick(item.id)} />
					}
				</div>
			</>
		} @else {
			<p class="hint">{"Избранных гифок пока нет: нажми звёздочку на гифке в чате или в панели гифок, и она появится здесь."}</p>
		}
		<div class="actions">
			@if (current) {
				<button onClick={() => pick(undefined)}>{"Убрать"}</button>
			}
			<button class="dark-gray" onClick={close}>{"Отмена"}</button>
		</div>
	</>
}
