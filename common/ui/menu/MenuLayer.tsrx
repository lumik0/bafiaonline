import { fromEvents, onCleanup, onMount } from "@common/ui";
import type { ContextMenuManager } from "@common/ui/menu/manager";

/** слой контекстного меню. Позиция считается в единицах интерфейса: учитывается масштаб окна и страницы */
export function MenuLayer({ manager }: { manager: ContextMenuManager }) @{
	const current = fromEvents(manager, "change", () => manager.current);
	let layer: HTMLDivElement;

	onMount(() => {
		const keydown = (event: KeyboardEvent) => {
			if(event.key == "Escape" && manager.isOpen) { manager.close(); event.stopImmediatePropagation(); event.preventDefault(); }
		};
		// меню - «всплывашка»: прокрутка, смена размера окна и потеря фокуса закрывают его
		const dismiss = () => manager.close();
		document.addEventListener("keydown", keydown, true);
		window.addEventListener("resize", dismiss);
		window.addEventListener("blur", dismiss);
		onCleanup(() => {
			document.removeEventListener("keydown", keydown, true);
			window.removeEventListener("resize", dismiss);
			window.removeEventListener("blur", dismiss);
		});
	});

	/** ставит меню к курсору и не даёт ему выйти за края */
	const place = (menu: HTMLElement) => {
		// элемент ещё не в документе: размер можно измерить только после вставки
		queueMicrotask(() => position(menu));
	};
	const position = (menu: HTMLElement) => {
		const open = manager.current;
		if(!open || !layer) return;
		const rect = layer.getBoundingClientRect();
		const factor = layer.offsetWidth ? rect.width / layer.offsetWidth : 1;
		const x = (open.x - rect.left) / factor, y = (open.y - rect.top) / factor;
		menu.style.left = Math.max(2, Math.min(x, layer.offsetWidth - menu.offsetWidth - 2)) + "px";
		menu.style.top = Math.max(2, Math.min(y, layer.offsetHeight - menu.offsetHeight - 2)) + "px";
	};

	<>
		<style>
			.layer { position: absolute; inset: 0; z-index: 300; pointer-events: none; }
			.shield { position: absolute; inset: 0; pointer-events: auto; }
			.menu { position: absolute; min-width: 170px; padding: 4px 0; border-radius: 6px; background: #f4f4f4; color: #111; box-shadow: 0 6px 24px rgba(0, 0, 0, .45), 0 0 0 1px rgba(0, 0, 0, .15); animation: appear .1s ease; }
			.item { padding: 7px 16px; font-size: 14px; cursor: pointer; white-space: nowrap; }
			.item:hover { background: var(--accent); color: #fff; }
			@keyframes appear { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: none; } }
		</style>
		<div class="layer" ref={layer}>
			@if (current()) {
				<div class="shield" onPointerDown={() => manager.close()} onContextMenu={(event) => { event.preventDefault(); manager.close(); }}>
					<div class="menu" ref={place} onPointerDown={(event) => event.stopPropagation()}>
						@for (const [index, label] of current()!.items.map((label, index) => [index, label] as const)) {
							<div class="item" role="menuitem" onClick={() => current()?.close(index)}>{label}</div>
						}
					</div>
				</div>
			}
		</div>
	</>
}
