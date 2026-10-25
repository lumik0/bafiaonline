import { createSignal, onCleanup, type Accessor } from "@common/ui";
import type { Entry, Navigator, RouteMap, Screens, Transition } from "@common/ui/nav/navigator";

type Animation = "" | "push-in" | "push-out" | "pop-in" | "pop-out" | "fade-in" | "fade-out";

interface Layer {
	entry: Entry<any>
	animation: Accessor<Animation>
	setAnimation: (animation: Animation) => void
}

const EDGE = 24;           // ширина зоны у левого края, с которой начинается жест «назад», px
const COMMIT_RATIO = .35;  // сколько ширины надо протянуть, чтобы вернуться
const COMMIT_SPEED = .5;   // или быстро смахнуть, px/мс

/**
 * экраны навигатора с переходами как на Android: новый выезжает справа,
 * при возврате наоборот; у левого края работает жест «назад» (смахнуть вправо)
 * живёт только верхний экран, на время перехода - два: предыдущий создаётся заново
 */
export function NavHost<R extends RouteMap>({ navigator, screens, duration = 300 }: { navigator: Navigator<R>, screens: Screens<R>, duration?: number }) @{
	const makeLayer = (entry: Entry<any>, initial: Animation = ""): Layer => {
		const [animation, setAnimation] = createSignal<Animation>(initial);
		return { entry, animation, setAnimation };
	};

	const first = navigator.top;
	const [layers, setLayers] = createSignal<Layer[]>(first ? [makeLayer(first)] : []);
	const [drag, setDrag] = createSignal<{ x: number, width: number } | undefined>(undefined);
	let finishTimer: ReturnType<typeof setTimeout> | undefined;
	let finish = () => {};

	// незаконченный переход доигрывается сразу: быстрые нажатия не копят лишние экраны
	const settle = () => {
		clearTimeout(finishTimer);
		finish();
		finish = () => {};
	};

	const run = (layer: Layer, keep: Layer, ms: number) => {
		finish = () => {
			keep.setAnimation("");
			setLayers([keep]);
		};
		if(ms <= 0) finish();
		else finishTimer = setTimeout(settle, ms);
	};

	const handle = (transition: Transition<R>) => {
		settle();
		const current = layers();
		const existing = current.find(layer => layer.entry.key == transition.to.key);

		if(!transition.animate || !transition.from) {
			setLayers([existing ?? makeLayer(transition.to)]);
			if(existing) existing.setAnimation("");
			return;
		}

		const out = current.find(layer => layer.entry.key == transition.from!.key) ?? makeLayer(transition.from);
		if(transition.type == "push") {
			const incoming = makeLayer(transition.to, "push-in");
			out.setAnimation("push-out");
			setLayers([out, incoming]);
			run(out, incoming, duration);
		} else if(transition.type == "pop") {
			const incoming = existing ?? makeLayer(transition.to);
			incoming.setAnimation("pop-in");
			out.setAnimation("pop-out");
			setLayers([incoming, out]);
			run(out, incoming, duration);
		} else {
			const incoming = makeLayer(transition.to, "fade-in");
			out.setAnimation("fade-out");
			setLayers([out, incoming]);
			run(out, incoming, Math.min(duration, 200));
		}
	};

	const subscription = navigator.on("change", handle);
	onCleanup(() => {
		subscription.remove();
		clearTimeout(finishTimer);
	});

	// --- жест «назад» ---
	const startGesture = (event: PointerEvent) => {
		const host = event.currentTarget as HTMLElement;
		const rect = host.getBoundingClientRect();
		if(event.pointerType == "mouse" || !navigator.canGoBack || event.clientX - rect.left > EDGE) return;
		settle();

		const top = layers().at(-1);
		const previous = navigator.previous;
		if(!top || !previous) return;
		const peek = makeLayer(previous);
		setLayers([peek, top]);

		const width = rect.width;
		const startX = event.clientX, startTime = performance.now();
		host.setPointerCapture(event.pointerId);
		setDrag({ x: 0, width });

		const move = (e: PointerEvent) => setDrag({ x: Math.max(0, e.clientX - startX), width });
		const end = (e: PointerEvent) => {
			host.removeEventListener("pointermove", move);
			host.removeEventListener("pointerup", end);
			host.removeEventListener("pointercancel", end);

			const dx = Math.max(0, e.clientX - startX);
			const speed = dx / Math.max(1, performance.now() - startTime);
			const commit = e.type == "pointerup" && (dx > width * COMMIT_RATIO || speed > COMMIT_SPEED);
			if(commit) {
				setDrag({ x: width, width });
				setTimeout(() => { setDrag(undefined); navigator.pop(false); }, 200);
			} else {
				setDrag({ x: 0, width });
				setTimeout(() => { setDrag(undefined); setLayers([top]); }, 200);
			}
		};
		host.addEventListener("pointermove", move);
		host.addEventListener("pointerup", end);
		host.addEventListener("pointercancel", end);
	};

	const layerStyle = (index: number) => {
		const state = drag();
		if(!state) return {};
		const progress = state.x / state.width;
		return index == layers().length - 1
			? { transform: `translateX(${state.x}px)`, transition: "none" }
			: { transform: `translateX(${-25 * (1 - progress)}%)`, filter: `brightness(${.7 + .3 * progress})`, transition: "none" };
	};

	<>
		<style>
			.host { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--screen-bg, var(--bg)); touch-action: pan-y; }
			/* --screen-bg задаёт игра (фон по умолчанию); у слоя он нужен непрозрачный, иначе под уезжающим экраном просвечивал бы предыдущий */
			.layer { position: absolute; inset: 0; background: var(--screen-bg, var(--bg)); will-change: transform; transition: transform .2s ease-out, filter .2s ease-out; }
			.layer.push-in { animation: push-in var(--nav-duration) cubic-bezier(.2, .9, .3, 1) both; box-shadow: -8px 0 24px rgba(0, 0, 0, .35); }
			.layer.push-out { animation: push-out var(--nav-duration) cubic-bezier(.2, .9, .3, 1) both; }
			.layer.pop-in { animation: pop-in var(--nav-duration) cubic-bezier(.2, .9, .3, 1) both; }
			.layer.pop-out { animation: pop-out var(--nav-duration) cubic-bezier(.2, .9, .3, 1) both; box-shadow: -8px 0 24px rgba(0, 0, 0, .35); }
			.layer.fade-in { animation: fade-in .2s ease both; }
			.layer.fade-out { animation: fade-out .2s ease both; }

			@keyframes push-in { from { transform: translateX(100%); } to { transform: none; } }
			@keyframes push-out { from { transform: none; filter: none; } to { transform: translateX(-25%); filter: brightness(.7); } }
			@keyframes pop-in { from { transform: translateX(-25%); filter: brightness(.7); } to { transform: none; filter: none; } }
			@keyframes pop-out { from { transform: none; } to { transform: translateX(100%); } }
			@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
			@keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }
		</style>
		<div class="host" style={{ "--nav-duration": duration + "ms" }} onPointerDown={startGesture}>
			@for (const layer of layers()) {
				<div class={"layer " + layer.animation()} style={layerStyle(layers().indexOf(layer))}>
					{screens[layer.entry.name]({ params: layer.entry.params, navigator })}
				</div>
			}
		</div>
	</>
}
