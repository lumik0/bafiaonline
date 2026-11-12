import { createEffect, createSignal, fromEvents, onCleanup } from "@common/ui";
import type { BadgeTip } from "./badge-tip";

interface Box { left: number, top: number, width: number, height: number }

/** рамка элемента в координатах слоя: окно игры может быть сдвинуто и масштабировано */
const box = (element: Element | null, layer: HTMLElement): Box | undefined => {
	if(!element) return undefined;
	const origin = layer.getBoundingClientRect(), scale = origin.width / (layer.offsetWidth || 1) || 1;
	const { left, top, width, height } = element.getBoundingClientRect();
	return width && height ? { left: (left - origin.left) / scale, top: (top - origin.top) / scale, width: width / scale, height: height / scale } : undefined;
};

/** подсказка про галочку: подсвечивает галочку на экране и соединяет её с плашкой бегущей линией, как подсказка про шерифа */
export function BadgeTipOverlay({ tip }: { tip: BadgeTip }) @{
	const active = fromEvents(tip, "change", () => tip.active);
	const [geo, setGeo] = createSignal<{ badge: Box, bubble: { x: number, y: number } } | undefined>(undefined);
	let bubble!: HTMLDivElement;
	let layer!: HTMLDivElement;

	// галочка может уехать при прокрутке чата: пересчитываем каждый кадр, пока подсказка есть; пропала с экрана - подсказка уходит
	createEffect(() => {
		if(!active()) { setGeo(undefined); return; }
		let frame = 0, lost = 0;
		const update = () => {
			if(!layer) { frame = requestAnimationFrame(update); return; }
			const target = [...document.querySelectorAll("[data-badge]")].map(element => box(element, layer)).find(found => found && found.top > 40 && found.top < layer.offsetHeight - 40) ?? undefined;
			if(!target) {
				// пару секунд ждём (чат мог перерисоваться), потом убираем
				if(++lost > 120) tip.stop();
				setGeo(undefined);
				frame = requestAnimationFrame(update);
				return;
			}
			lost = 0;
			const width = bubble?.offsetWidth ?? 230, height = bubble?.offsetHeight ?? 90;
			const clamp = (value: number, max: number) => Math.max(8, Math.min(max, value));
			// под галочкой, а если снизу нет места - над ней
			const below = target.top + target.height + 22 + height < layer.offsetHeight - 8;
			const x = clamp(target.left + target.width / 2 - width / 2, layer.offsetWidth - width - 8);
			const y = below ? target.top + target.height + 22 : target.top - height - 22;
			setGeo({ badge: target, bubble: { x: Math.round(x), y: Math.round(y) } });
			frame = requestAnimationFrame(update);
		};
		update();
		onCleanup(() => cancelAnimationFrame(frame));
	});

	// линия от плашки к галочке
	const path = () => {
		const current = geo();
		if(!current) return "";
		const { badge, bubble: place } = current;
		const bx = badge.left + badge.width / 2, by = badge.top + badge.height / 2;
		const width = 230, height = bubble?.offsetHeight ?? 90;
		const sx = Math.max(place.x + 12, Math.min(place.x + width - 12, bx)), sy = place.y > by ? place.y : place.y + height;
		return `M${sx} ${sy} L${bx} ${by}`;
	};

	<>
		<style>
			.layer { position: fixed; inset: 0; z-index: 9400; pointer-events: none; }
			.layer svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
			.line { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linecap: round; stroke-dasharray: 6 8; opacity: .8; animation: flow 1s linear infinite, fade-in .6s; }
			.glow { position: absolute; border-radius: 6px; outline: 2px solid var(--accent); box-shadow: 0 0 14px 2px var(--accent); animation: glow 1.6s ease-in-out infinite, fade-in .5s; }
			.ripple { position: absolute; border-radius: 50%; border: 2px solid var(--accent); animation: ripple 2s ease-out infinite; }
			.ripple.second { animation-delay: 1s; }
			.bubble { position: absolute; left: 0; top: 0; width: 230px; box-sizing: border-box; padding: 9px 12px; border-radius: 12px; background: var(--accent); color: #fff; font-size: 13px; line-height: 1.35; box-shadow: 0 8px 24px rgba(0, 0, 0, .35); pointer-events: auto; cursor: pointer; transition: transform .35s cubic-bezier(.22, 1.1, .36, 1); animation: pop .5s cubic-bezier(.22, 1.1, .36, 1); }
			.bubble .title { display: block; font-size: 11px; font-weight: 700; letter-spacing: .04em; opacity: .85; margin-bottom: 2px; text-transform: uppercase; }
			.bubble .close { display: block; margin-top: 4px; font-size: 11px; opacity: .75; }
			.float { animation: float 3s ease-in-out infinite; }
			@keyframes ripple { from { transform: scale(.6); opacity: .9; } to { transform: scale(2.6); opacity: 0; } }
			@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
			@keyframes flow { to { stroke-dashoffset: -14; } }
			@keyframes glow { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
			@keyframes fade-in { from { opacity: 0; } }
			@keyframes pop { from { opacity: 0; scale: .8; } }
			@media (prefers-reduced-motion: reduce) { .line, .glow, .bubble, .ripple, .float { animation: none; } .ripple { display: none; } .bubble { transition: none; } }
		</style>
		@if (active()) {
			<div class="layer" aria-live="polite" ref={layer}>
				<svg>
					@if (geo()) {
						<path class="line" d={path()} />
					}
				</svg>
				@if (geo()) {
					<>
						<div class="glow" style={{ left: geo()!.badge.left - 3 + "px", top: geo()!.badge.top - 3 + "px", width: geo()!.badge.width + 6 + "px", height: geo()!.badge.height + 6 + "px" }}></div>
						@if (!tip.calm) {
							<>
								<div class="ripple" style={{ left: geo()!.badge.left + "px", top: geo()!.badge.top + "px", width: geo()!.badge.width + "px", height: geo()!.badge.height + "px" }}></div>
								<div class="ripple second" style={{ left: geo()!.badge.left + "px", top: geo()!.badge.top + "px", width: geo()!.badge.width + "px", height: geo()!.badge.height + "px" }}></div>
							</>
						}
					</>
				}
				<div class="bubble" ref={bubble} onClick={() => tip.stop()} style={{ transform: `translate(${geo()?.bubble.x ?? 8}px, ${geo()?.bubble.y ?? 8}px)`, visibility: geo() ? "visible" : "hidden" }}>
					<div class="float">
						<span class="title">Подсказка</span>
						<span>{tip.text}</span>
						<span class="close">Нажми, чтобы закрыть</span>
					</div>
				</div>
			</div>
		}
	</>
}
