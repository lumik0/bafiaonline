import { fromEvents } from "@common/ui";
import type { WindowHandle, WindowManager } from "../windows/manager";

const isImage = (icon: string) => icon.startsWith("https://");

function toggle(manager: WindowManager, win: WindowHandle) {
	// как в системе: свёрнутое - вернуть, активное - свернуть, остальное - вывести вперёд
	if(win.minimized || !win.active) win.focus();
	else win.minimize();
}

export function Dock({ manager }: { manager: WindowManager }) @{
	const items = fromEvents(manager, "change", () => manager.windows.filter(win => win.showInDock));
	// у развёрнутого на весь экран окна док прячется и выезжает, когда подвести курсор к нижнему краю
	const hidden = fromEvents(manager, "change", () => manager.hasMaximized);

	<>
		<style>
			.zone { position: fixed; left: 0; right: 0; bottom: 0; height: 14px; z-index: 5000; display: flex; justify-content: center; }
			.dock {
				position: absolute; bottom: 8px; display: flex; align-items: center; gap: 10px;
				height: 52px; padding: 0 12px; border-radius: 20px;
				background: var(--dock-bg); border: 2px solid var(--dock-border);
				backdrop-filter: blur(12px);
				transition: transform .35s ease, opacity .35s ease;
				animation: dock-in .5s ease;
			}
			.zone.hidden .dock { transform: translateY(90px); opacity: 0; }
			.zone.hidden:hover .dock { transform: none; opacity: 1; }
			.zone.hidden:hover { height: 90px; }
			@keyframes dock-in { from { opacity: 0; transform: translateY(80px); } to { opacity: 1; transform: none; } }
		</style>
		<div class={hidden() ? "zone hidden" : "zone"}>
			<div class="dock">
				@for (const win of items()) {
					<DockIcon manager={manager} win={win} />
				}
			</div>
		</div>
	</>
}

function DockIcon({ manager, win }: { manager: WindowManager, win: WindowHandle }) @{
	const state = fromEvents(manager, "change", () => ({ active: win.active, minimized: win.minimized, closing: win.closing, title: win.title }));

	<>
		<style>
			.icon {
				position: relative; width: 34px; height: 34px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
				font-size: 28px; line-height: 1; cursor: pointer; user-select: none; -webkit-user-select: none;
				transition: transform .15s ease;
				animation: icon-in .35s cubic-bezier(.3, 1.6, .5, 1);
			}
			.icon:hover { transform: translateY(-6px) scale(1.18); }
			.icon.minimized { opacity: .6; }
			.icon.closing { animation: icon-out .2s ease forwards; pointer-events: none; }
			.icon img { width: 100%; height: 100%; border-radius: 9px; pointer-events: none; }
			.dot { position: absolute; bottom: -8px; width: 4px; height: 4px; border-radius: 50%; background: var(--dock-indicator); opacity: .5; }
			.icon.active .dot { opacity: 1; }

			@keyframes icon-in { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
			@keyframes icon-out { to { transform: scale(0); opacity: 0; width: 0; margin: 0 -5px; } }
		</style>
		<div
			class={"icon" + (state().active ? " active" : "") + (state().minimized ? " minimized" : "") + (state().closing ? " closing" : "")}
			title={state().title}
			onClick={() => toggle(manager, win)}
		>
			@if (isImage(win.icon)) {
				<img src={win.icon} alt="" />
			} @else {
				<span>{win.icon || "🗔"}</span>
			}
			<span class="dot"></span>
		</div>
	</>
}
