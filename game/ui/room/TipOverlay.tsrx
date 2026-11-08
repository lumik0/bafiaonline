import { createEffect, createSignal, fromEvents, onCleanup } from "@common/ui";
import type { RoomTip } from "./room-tip";

const SPARKS = [[8, 0, -10, -26, 0], [30, 0, 6, -30, .5], [55, 0, -4, -24, 1.1], [80, 0, 12, -28, .3], [95, 40, 24, -14, 1.5], [0, 60, -26, 8, .9], [70, 100, 10, 24, 1.8], [20, 100, -12, 22, .2]].map(([x, y, dx, dy, delay]) => ({ x, y, dx, dy, delay }));
const COLORS = ["#ffd25f", "#6bdc7e", "#5ac8fa", "#ff8a80", "#fff"];
const CONFETTI = Array.from({ length: 18 }, (_, i) => {
	const angle = i / 18 * Math.PI * 2 + (i % 3) * .3, power = 60 + (i * 37) % 60;
	return { color: COLORS[i % COLORS.length]!, dx: Math.round(Math.cos(angle) * power), dy: Math.round(Math.sin(angle) * power - 20), rot: (i * 97) % 540 - 270, delay: (i % 4) * .04 };
});

interface Box { left: number, top: number, width: number, height: number }

/** рамка элемента в координатах слоя: окно игры может быть сдвинуто и масштабировано, поэтому от экрана считать нельзя */
const box = (element: Element | null, layer: HTMLElement): Box | undefined => {
	if(!element) return undefined;
	const origin = layer.getBoundingClientRect(), scale = origin.width / (layer.offsetWidth || 1) || 1;
	const { left, top, width, height } = element.getBoundingClientRect();
	return width && height ? { left: (left - origin.left) / scale, top: (top - origin.top) / scale, width: width / scale, height: height / scale } : undefined;
};

/**
 * подсказка поверх комнаты: подсвечивает сообщение в чате и игрока на столе, соединяет их бегущей линией,
 * плашка с текстом плавно переезжает от сообщения к игроку по мере шагов
 */
export function TipOverlay({ tip }: { tip: RoomTip }) @{
	const state = fromEvents(tip, "change", () => tip.active ? { player: tip.player!, entry: tip.entry!, step: tip.step, text: tip.text } : undefined);
	const [geo, setGeo] = createSignal<{ message?: Box, cell?: Box, bubble: { x: number, y: number } } | undefined>(undefined);
	let bubble!: HTMLDivElement;
	let layer!: HTMLDivElement;

	// позиции следят за прокруткой чата и размером окна: пересчитываем каждый кадр, пока подсказка есть
	createEffect(() => {
		const current = state();
		if(!current) { setGeo(undefined); return; }
		let frame = 0;
		const update = () => {
			if(!layer) { frame = requestAnimationFrame(update); return; }
			const message = box(document.querySelector(`[data-entry="${current.entry}"]`), layer);
			const cell = box(document.querySelector(`[data-player="${CSS.escape(current.player)}"]`), layer);
			const viewWidth = layer.offsetWidth, viewHeight = layer.offsetHeight;
			const width = bubble?.offsetWidth ?? 220, height = bubble?.offsetHeight ?? 60;
			const clamp = (value: number, max: number) => Math.max(8, Math.min(max, value));
			let x: number, y: number;
			if(current.step == "hold" && message) {
				// над сообщением (или под ним, если сверху нет места)
				x = clamp(message.left, viewWidth - width - 8);
				y = message.top - height - 12 < 8 ? message.top + message.height + 12 : message.top - height - 12;
			} else if(cell) {
				// слева от игрока
				x = clamp(cell.left - width - 14, viewWidth - width - 8);
				y = clamp(cell.top + cell.height / 2 - height / 2, viewHeight - height - 8);
			} else { x = 8; y = 8; }
			setGeo({ message, cell, bubble: { x: Math.round(x), y: Math.round(y) } });
			frame = requestAnimationFrame(update);
		};
		update();
		onCleanup(() => cancelAnimationFrame(frame));
	});

	// линия от правого края сообщения к левому краю игрока, чуть изогнутая
	const path = () => {
		const { message, cell } = geo() ?? {};
		if(!message || !cell) return "";
		const x1 = message.left + message.width, y1 = message.top + message.height / 2, x2 = cell.left, y2 = cell.top + cell.height / 2;
		const bend = Math.max(40, Math.abs(x2 - x1) / 2);
		return `M${x1} ${y1} C${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
	};

	<>
		<style>
			.layer { position: fixed; inset: 0; z-index: 9400; pointer-events: none; }
			.layer svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
			.line { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linecap: round; stroke-dasharray: 6 8; opacity: .8; animation: flow 1s linear infinite, fade-in .6s; }
			.glow { position: absolute; border-radius: 8px; outline: 2px solid var(--accent); box-shadow: 0 0 16px 2px var(--accent); animation: glow 1.6s ease-in-out infinite, fade-in .5s; transition: left .15s, top .15s; }
			.bubble { position: absolute; left: 0; top: 0; width: 230px; box-sizing: border-box; padding: 9px 12px; border-radius: 12px; background: var(--accent); color: #fff; font-size: 13px; line-height: 1.35; box-shadow: 0 8px 24px rgba(0, 0, 0, .35); transition: transform .7s cubic-bezier(.22, 1.1, .36, 1); animation: pop .5s cubic-bezier(.22, 1.1, .36, 1); }
			.bubble.done { background: #2fb44c; }
			.bubble .step { display: block; animation: fade-in .35s; }
			.bubble .title { display: block; font-size: 11px; font-weight: 700; letter-spacing: .04em; opacity: .85; margin-bottom: 2px; text-transform: uppercase; }
			/* круги от игрока, как нажатие пальцем */
			.ripple { position: absolute; border-radius: 50%; border: 2px solid var(--accent); animation: ripple 2s ease-out infinite; }
			.ripple.second { animation-delay: 1s; }
			/* бегущая точка по линии */
			.dot { fill: #fff; filter: drop-shadow(0 0 4px var(--accent)); }
			/* плашка слегка парит, искры и конфетти разлетаются от неё */
			.float { animation: float 3s ease-in-out infinite; }
			.spark { position: absolute; width: 6px; height: 6px; border-radius: 50%; background: #fff; opacity: 0; animation: spark 2.4s ease-out infinite; }
			.confetti { position: absolute; left: 50%; top: 50%; width: 7px; height: 11px; border-radius: 2px; opacity: 0; animation: confetti 1.3s cubic-bezier(.2, .8, .3, 1) forwards; }
			@keyframes ripple { from { transform: scale(.6); opacity: .9; } to { transform: scale(2.4); opacity: 0; } }
			@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
			@keyframes spark { 0% { transform: translate(0, 0) scale(.4); opacity: 0; } 20% { opacity: .95; } 100% { transform: translate(var(--dx), var(--dy)) scale(1.1); opacity: 0; } }
			@keyframes confetti { 0% { transform: translate(0, 0) rotate(0); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; } }
			@keyframes flow { to { stroke-dashoffset: -14; } }
			@keyframes glow { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
			@keyframes fade-in { from { opacity: 0; } }
			@keyframes pop { from { opacity: 0; scale: .8; } }
			@media (prefers-reduced-motion: reduce) { .line, .glow, .bubble, .bubble .step, .ripple, .float, .spark, .confetti { animation: none; } .spark, .confetti, .ripple, .dot { display: none; } .bubble { transition: none; } }
		</style>
		@if (state()) {
			<div class="layer" aria-live="polite" ref={layer}>
				<svg>
					@if (geo() && state()!.step != "done") {
						<>
							<path class="line" d={path()} />
							@if (!tip.calm && path()) {
								<circle class="dot" r="4"><animateMotion dur="1.8s" repeatCount="indefinite" path={path()} /></circle>
							}
						</>
					}
				</svg>
				@if (geo()?.message && state()!.step == "hold") {
					<div class="glow" style={{ left: geo()!.message!.left - 3 + "px", top: geo()!.message!.top - 2 + "px", width: geo()!.message!.width + 6 + "px", height: geo()!.message!.height + 4 + "px" }}></div>
				}
				@if (geo()?.cell && state()!.step != "done") {
					<div class="glow" style={{ left: geo()!.cell!.left - 2 + "px", top: geo()!.cell!.top - 2 + "px", width: geo()!.cell!.width + 4 + "px", height: geo()!.cell!.height + 4 + "px" }}></div>
				}
				@if (geo()?.cell && state()!.step != "done" && !tip.calm) {
					<>
					<div class="ripple" style={{ left: geo()!.cell!.left + "px", top: geo()!.cell!.top + "px", width: geo()!.cell!.width + "px", height: geo()!.cell!.height + "px" }}></div>
					<div class="ripple second" style={{ left: geo()!.cell!.left + "px", top: geo()!.cell!.top + "px", width: geo()!.cell!.width + "px", height: geo()!.cell!.height + "px" }}></div>
					</>
				}
				<div class={state()!.step == "done" ? "bubble done" : "bubble"} ref={bubble} style={{ transform: `translate(${geo()?.bubble.x ?? 8}px, ${geo()?.bubble.y ?? 8}px)`, visibility: geo() ? "visible" : "hidden" }}>
					<div class="float">
						<span class="title">Подсказка</span>
						@for (const text of [state()!.text]) {
							<span class="step">{text}</span>
						}
					</div>
					@if (!tip.calm && state()!.step != "done") {
						@for (const spark of SPARKS) {
							<span class="spark" style={{ left: spark.x + "%", top: spark.y + "%", "--dx": spark.dx + "px", "--dy": spark.dy + "px", "animation-delay": spark.delay + "s" }}></span>
						}
					}
					@if (!tip.calm && state()!.step == "done") {
						@for (const piece of CONFETTI) {
							<span class="confetti" style={{ background: piece.color, "--dx": piece.dx + "px", "--dy": piece.dy + "px", "--rot": piece.rot + "deg", "animation-delay": piece.delay + "s" }}></span>
						}
					}
				</div>
			</div>
		}
	</>
}
