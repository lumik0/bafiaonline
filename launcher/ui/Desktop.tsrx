import { fromEvents, onCleanup, onMount } from "@common/ui";
import type { WindowManager } from "../windows/manager";
import { Dock } from "./Dock.tsrx";
import { WindowFrame } from "./WindowFrame.tsrx";

/** рабочий стол: слой окон и док. Окна открывает `manager.open()`, всё остальное делает сам */
export function Desktop({ manager, showDock }: { manager: WindowManager, showDock?: () => boolean }) @{
	const windows = fromEvents(manager, "change", () => [...manager.windows]);
	const scale = fromEvents(manager, "change", () => manager.scale);

	onMount(() => {
		const resize = () => manager.viewportChanged();
		window.addEventListener("resize", resize);
		onCleanup(() => window.removeEventListener("resize", resize));
	});

	<>
		<style>
			.desktop { position: fixed; left: 0; top: 0; overflow: hidden; background: var(--desktop-bg); transform-origin: 0 0; }
		</style>
		<div class="desktop bafia" style={{ width: "calc(100vw / " + scale() + ")", height: "calc(100vh / " + scale() + ")", transform: "scale(" + scale() + ")" }}>
			@for (const win of windows()) {
				<WindowFrame win={win} manager={manager} />
			}
			@if (showDock ? showDock() : true) {
				<Dock manager={manager} />
			}
		</div>
	</>
}
