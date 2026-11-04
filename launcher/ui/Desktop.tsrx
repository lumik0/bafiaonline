import { createSignal, fromEvents, onCleanup, onMount } from "@common/ui";
import type { WindowManager } from "../windows/manager";
import { visibleBox } from "../windows/manager";
import { Dock } from "./Dock.tsrx";
import { WindowFrame } from "./WindowFrame.tsrx";

/** рабочий стол: слой окон и док. Окна открывает `manager.open()`, всё остальное делает сам */
export function Desktop({ manager, showDock }: { manager: WindowManager, showDock?: () => boolean }) @{
	const windows = fromEvents(manager, "change", () => [...manager.windows]);
	const scale = fromEvents(manager, "change", () => manager.scale);

	// рабочий стол занимает видимую область: с открытой клавиатурой на телефоне она меньше окна браузера и смещена
	const read = () => visibleBox(window);
	const [box, setBox] = createSignal(read());

	onMount(() => {
		const resize = () => { setBox(read()); manager.viewportChanged(); };
		window.addEventListener("resize", resize);
		window.visualViewport?.addEventListener("resize", resize);
		window.visualViewport?.addEventListener("scroll", resize);
		onCleanup(() => {
			window.removeEventListener("resize", resize);
			window.visualViewport?.removeEventListener("resize", resize);
			window.visualViewport?.removeEventListener("scroll", resize);
		});
	});

	<>
		<style>
			.desktop { position: fixed; left: 0; top: 0; overflow: hidden; background: var(--desktop-bg); transform-origin: 0 0; }
		</style>
		<div class="desktop bafia" style={{ left: box().left + "px", top: box().top + "px", width: "calc(" + box().width + "px / " + scale() + ")", height: "calc(" + box().height + "px / " + scale() + ")", transform: "scale(" + scale() + ")" }}>
			@for (const win of windows()) {
				<WindowFrame win={win} manager={manager} />
			}
			@if (showDock ? showDock() : true) {
				<Dock manager={manager} />
			}
		</div>
	</>
}
