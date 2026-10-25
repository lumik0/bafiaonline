import { createSignal, fromEvents } from "@common/ui";
import type { Bounds, ResizeDirection } from "../windows/geometry";
import type { WindowHandle, WindowManager } from "../windows/manager";

const directions: ResizeDirection[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

/** перетаскивание через pointer capture: мышь и палец, без обработчиков на document */
function track(event: PointerEvent, scale: number, onMove: (dx: number, dy: number) => void): Promise<void> {
	const target = event.currentTarget as HTMLElement;
	const startX = event.clientX, startY = event.clientY;
	target.setPointerCapture(event.pointerId);

	return new Promise(resolve => {
		// пальцы и мышь двигаются в экранных пикселях, а окна считаются в увеличенных единицах интерфейса
		const move = (e: PointerEvent) => onMove((e.clientX - startX) / scale, (e.clientY - startY) / scale);
		const stop = () => {
			target.removeEventListener("pointermove", move);
			target.removeEventListener("pointerup", stop);
			target.removeEventListener("pointercancel", stop);
			resolve();
		};
		target.addEventListener("pointermove", move);
		target.addEventListener("pointerup", stop);
		target.addEventListener("pointercancel", stop);
	});
}

export function WindowFrame({ win, manager }: { win: WindowHandle, manager: WindowManager }) @{
	const state = fromEvents(win, "change", () => ({
		bounds: win.bounds, mode: win.mode, locked: win.locked, closing: win.closing, title: win.title, active: win.active
	}));
	const order = fromEvents(manager, "change", () => ({ z: manager.zIndex(win), active: win.active }));
	const [dragging, setDragging] = createSignal(false);

	const startMove = (event: PointerEvent) => {
		if((event.target as HTMLElement).closest(".lights")) return;
		win.focus();
		if(!win.options.movable || win.maximized) return;
		const start = win.bounds;
		setDragging(true);
		void track(event, manager.scale, (dx, dy) => win.move(start.x + dx, start.y + dy)).then(() => setDragging(false));
	};

	const startResize = (direction: ResizeDirection, event: PointerEvent) => {
		event.stopPropagation();
		win.focus();
		const start: Bounds = win.bounds;
		setDragging(true);
		void track(event, manager.scale, (dx, dy) => win.resize(start, direction, dx, dy)).then(() => setDragging(false));
	};

	<>
		<style>
			.frame {
				position: absolute; display: flex; flex-direction: column;
				border-radius: 9px; overflow: hidden;
				background: var(--window-bg); border: 1px solid var(--window-border);
				box-shadow: 0 10px 40px rgba(0, 0, 0, .45), 0 0 0 .5px rgba(0, 0, 0, .3);
				animation: window-open .3s cubic-bezier(.11, .05, .22, .81);
				transition: left .25s, top .25s, width .25s, height .25s, opacity .25s, transform .25s, border-radius .25s;
			}
			.frame.dragging { transition: none; }
			.frame.maximized { border-radius: 0; border: none; }
			.frame.inactive { box-shadow: 0 6px 24px rgba(0, 0, 0, .3); }
			.frame.minimized { opacity: 0; transform: translateY(40vh) scale(.5); pointer-events: none; }
			.frame.closing { animation: window-close .2s cubic-bezier(.11, .05, .22, .81) forwards; pointer-events: none; }

			.titlebar {
				flex: none; height: 28px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
				background: var(--window-title-bg); color: var(--window-title-text);
				border-bottom: 1px solid var(--window-border); user-select: none; -webkit-user-select: none; touch-action: none;
			}
			.frame.inactive .titlebar { background: var(--window-title-inactive-bg); }
			.frame.inactive .title { opacity: .55; }
			.title { font-size: 12px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60vw; }

			.lights { display: flex; gap: 7px; padding-left: 10px; }
			.light {
				width: 12px; height: 12px; border-radius: 50%; padding: 0; border: .5px solid rgba(0, 0, 0, .2);
				display: flex; align-items: center; justify-content: center;
				font-size: 9px; line-height: 1; color: transparent; cursor: default;
			}
			.lights:hover .light { color: rgba(0, 0, 0, .6); }
			.light.off { background: #9a9a9a; pointer-events: none; }
			.close { background: #ff605c; }
			.minimize { background: #ffbd44; }
			.maximize { background: #00ca4e; }
			.frame.inactive .light:not(.off) { background: #cfcfcf; }
			.frame.inactive .lights:hover .close { background: #ff605c; }
			.frame.inactive .lights:hover .minimize { background: #ffbd44; }
			.frame.inactive .lights:hover .maximize { background: #00ca4e; }

			.content { flex: 1; min-height: 0; overflow: hidden; position: relative; }
			.scale { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
			.lock { position: absolute; inset: 0; background: rgba(0, 0, 0, .5); z-index: 50; }

			.handle { position: absolute; z-index: 10; touch-action: none; }
			.n, .s { left: 8px; right: 8px; height: 5px; cursor: ns-resize; }
			.e, .w { top: 8px; bottom: 8px; width: 5px; cursor: ew-resize; }
			.n { top: -2px; } .s { bottom: -2px; } .e { right: -2px; } .w { left: -2px; }
			.ne, .nw, .se, .sw { width: 12px; height: 12px; }
			.ne { top: -2px; right: -2px; cursor: nesw-resize; } .nw { top: -2px; left: -2px; cursor: nwse-resize; }
			.se { bottom: -2px; right: -2px; cursor: nwse-resize; } .sw { bottom: -2px; left: -2px; cursor: nesw-resize; }

			@keyframes window-open { 0% { opacity: .4; transform: scale(.9); } 50% { opacity: .9; transform: scale(1.025); } 100% { opacity: 1; transform: scale(1); } }
			@keyframes window-close { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(.9); } }
		</style>
		<div
			class={
				"frame"
				+ (state().mode == "maximized" ? " maximized" : "")
				+ (state().mode == "minimized" ? " minimized" : "")
				+ (state().closing ? " closing" : "")
				+ (order().active ? "" : " inactive")
				+ (dragging() ? " dragging" : "")
			}
			style={{
				left: state().bounds.x + "px", top: state().bounds.y + "px",
				width: state().bounds.width + "px", height: state().bounds.height + "px",
				"z-index": order().z
			}}
			onPointerDown={() => win.focus()}
		>
			@if (win.options.titleBar) {
				<div class="titlebar" onPointerDown={startMove} onDblClick={() => win.toggleMaximize()}>
					<div class="lights">
						<div class={"light close" + (win.options.closable ? "" : " off")} onClick={() => win.options.closable && void win.close()}>{"×"}</div>
						<div class={"light minimize" + (win.options.minimizable ? "" : " off")} onClick={() => win.minimize()}>{"−"}</div>
						<div class={"light maximize" + (win.options.maximizable ? "" : " off")} onClick={() => win.toggleMaximize()}>{"+"}</div>
					</div>
					<div class="title">{state().title}</div>
					<div></div>
				</div>
			}
			<div class="content">
				<div class="scale" style={{ width: "calc(100% / " + win.options.zoom + ")", height: "calc(100% / " + win.options.zoom + ")", transform: "scale(" + win.options.zoom + ")" }}>{win.content}</div>
				@if (state().locked) {
					<div class="lock"></div>
				}
			</div>
			@if (win.options.resizable && state().mode == "normal") {
				@for (const direction of directions) {
					<div class={"handle " + direction} onPointerDown={(event) => startResize(direction, event)}></div>
				}
			}
		</div>
	</>
}
