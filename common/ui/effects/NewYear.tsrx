const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** частицы заранее случайные, но один раз: пересоздавать их при каждом обновлении незачем */
function make(count: number, build: (index: number) => Record<string, string>) {
	return Array.from({ length: count }, (_, index) => build(index));
}

const LIGHTS = ["#ff4d4d", "#ffd23f", "#4dd96a", "#4da6ff", "#ff7ad9"];

/** новый год: снегопад, мигающая гирлянда сверху, холодное свечение снизу */
export function NewYear({ light }: { light?: boolean }) @{
	const scale = light ? 0.5 : 1;
	const count = (n: number) => Math.max(1, Math.round(n * scale));

	const flakes = make(count(36), () => ({
		"--x": rand(0, 100).toFixed(1) + "vw", "--size": rand(8, 20).toFixed(0) + "px", "--drift": rand(-10, 10).toFixed(0) + "vw",
		"--dur": rand(9, 20).toFixed(1) + "s", "--delay": "-" + rand(0, 20).toFixed(1) + "s", "--alpha": rand(.45, .95).toFixed(2)
	}));
	const bulbs = make(count(18), index => ({
		"--x": (index * (100 / Math.max(1, count(18) - 1))).toFixed(2) + "%", "--color": LIGHTS[index % LIGHTS.length]!,
		"--dur": rand(1.2, 2.4).toFixed(1) + "s", "--delay": "-" + rand(0, 2.4).toFixed(1) + "s"
	}));

	<>
		<style>
			.newyear { position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 9000; }
			.glow { position: absolute; left: 0; right: 0; bottom: 0; height: 24vh; background: radial-gradient(ellipse at 50% 120%, rgba(120, 200, 255, .28), transparent 70%); }
			.wire { position: absolute; left: 0; right: 0; top: 0; height: 14px; border-bottom: 2px solid rgba(20, 60, 30, .75); border-radius: 0 0 50% 50% / 0 0 100% 100%; }
			.bulb { position: absolute; top: 4px; left: var(--x); width: 9px; height: 13px; margin-left: -4px; border-radius: 50% 50% 55% 55%; background: var(--color); box-shadow: 0 0 10px 3px var(--color); animation: twinkle var(--dur) ease-in-out var(--delay) infinite; }
			.flake { position: absolute; left: var(--x); top: -30px; font-size: var(--size); color: #fff; opacity: 0; text-shadow: 0 0 6px rgba(160, 210, 255, .9); animation: fall var(--dur) linear var(--delay) infinite; will-change: transform, opacity; }
			@keyframes fall { 0% { transform: translate(0, 0) rotate(0deg); opacity: 0; } 8% { opacity: var(--alpha); } 90% { opacity: var(--alpha); } 100% { transform: translate(var(--drift), 108vh) rotate(300deg); opacity: 0; } }
			@keyframes twinkle { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
			@media (prefers-reduced-motion: reduce) { .newyear { display: none; } }
		</style>
		<div class="newyear" aria-hidden="true">
			<div class="glow"></div>
			<div class="wire"></div>
			@for (const style of bulbs) {
				<div class="bulb" style={style}></div>
			}
			@for (const style of flakes) {
				<div class="flake" style={style}>{"❄"}</div>
			}
		</div>
	</>
}
