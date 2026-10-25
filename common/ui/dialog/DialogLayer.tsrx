import { fromEvents, onCleanup, onMount } from "@common/ui";
import type { DialogManager } from "@common/ui/dialog/manager";

/** слой окон поверх экрана: затемнение, карточка с заголовком, закрытие по Esc и по клику на затемнение */
export function DialogLayer({ manager }: { manager: DialogManager }) @{
	const entries = fromEvents(manager, "change", () => [...manager.entries]);

	onMount(() => {
		const keydown = (event: KeyboardEvent) => {
			if(event.key == "Escape" && manager.dismissTop()) event.stopImmediatePropagation();
		};
		document.addEventListener("keydown", keydown);
		onCleanup(() => document.removeEventListener("keydown", keydown));
	});

	<>
		<style>
			.backdrop { position: absolute; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; background: rgba(0, 0, 0, .55); animation: fade .15s ease; }
			.card { width: min(360px, 100%); max-height: 100%; display: flex; flex-direction: column; border-radius: 10px; background: var(--dialog-bg); color: var(--text-dark); box-shadow: 0 12px 40px rgba(0, 0, 0, .5); animation: pop .18s cubic-bezier(.2, .9, .3, 1.2); overflow: hidden; }
			.card.wide { width: min(560px, 100%); }
			.head { flex: none; padding: 12px 16px; background: var(--header-bg); color: var(--header-text); font-weight: 600; font-size: 15px; letter-spacing: .3px; }
			.body { padding: 14px 16px 16px; overflow: auto; color: var(--text-dark); }
			@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
			@keyframes pop { from { opacity: 0; transform: scale(.92); } to { opacity: 1; transform: none; } }
		</style>
		@for (const entry of entries()) {
			<div class="backdrop" onPointerDown={(event) => { if(event.target == event.currentTarget && entry.dismissable) entry.close(undefined); }}>
				<div class={entry.wide ? "card wide" : "card"} role="dialog" aria-modal="true" style={entry.width ? { width: "min(" + entry.width + "px, 100%)" } : undefined}>
					@if (entry.title) {
						<div class="head">{entry.title}</div>
					}
					<div class="body">{entry.render(entry.close)}</div>
				</div>
			</div>
		}
	</>
}
