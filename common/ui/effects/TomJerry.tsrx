const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** частицы заранее случайные, но один раз: пересоздавать их при каждом обновлении незачем */
function make(count: number, build: (index: number) => Record<string, string>) {
	return Array.from({ length: count }, (_, index) => build(index));
}

/** том и джерри: всплывают сердечки, падает сыр, по низу экрана убегает мышонок, а за ним несётся кот, и остаются следы лапок */
export function TomJerry({ light }: { light?: boolean }) @{
	const scale = light ? 0.5 : 1;
	const count = (n: number) => Math.max(1, Math.round(n * scale));

	const hearts = make(count(14), () => ({
		"--x": rand(2, 96).toFixed(1) + "vw", "--size": rand(14, 30).toFixed(0) + "px", "--drift": rand(-8, 8).toFixed(0) + "vw",
		"--dur": rand(8, 16).toFixed(1) + "s", "--delay": "-" + rand(0, 16).toFixed(1) + "s"
	}));
	const cheese = make(count(6), () => ({
		"--x": rand(2, 96).toFixed(1) + "vw", "--size": rand(20, 34).toFixed(0) + "px", "--drift": rand(-6, 6).toFixed(0) + "vw",
		"--dur": rand(14, 26).toFixed(1) + "s", "--delay": "-" + rand(0, 26).toFixed(1) + "s", "--spin": rand(-240, 240).toFixed(0) + "deg"
	}));
	const paws = make(count(8), index => ({
		"--x": (6 + index * (88 / Math.max(1, count(8)))).toFixed(1) + "vw", "--up": (index % 2 ? 7 : 0) + "px",
		"--dur": "9s", "--delay": "-" + (index * 1.05).toFixed(2) + "s"
	}));

	<>
		<style>
			.tj { position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 9000; }
			.heart, .cheese { position: absolute; left: var(--x); opacity: 0; will-change: transform, opacity; }
			.heart { bottom: -40px; font-size: var(--size); animation: up var(--dur) ease-in-out var(--delay) infinite; }
			.cheese { top: -40px; font-size: var(--size); animation: down var(--dur) linear var(--delay) infinite; }
			.run { position: absolute; bottom: 14px; left: 0; font-size: 30px; line-height: 1; white-space: nowrap; animation: run 9s linear infinite; will-change: transform; }
			.run span { display: inline-block; animation: hop .35s ease-in-out infinite; }
			.run .cat { margin-left: 70px; font-size: 40px; animation-duration: .45s; }
			.paw { position: absolute; bottom: calc(10px + var(--up)); left: var(--x); font-size: 12px; opacity: 0; animation: paw var(--dur) linear var(--delay) infinite; }
			@keyframes up { 0% { transform: translate(0, 0) scale(.8); opacity: 0; } 12% { opacity: .85; } 85% { opacity: .85; } 100% { transform: translate(var(--drift), -108vh) scale(1.15); opacity: 0; } }
			@keyframes down { 0% { transform: translate(0, 0) rotate(0deg); opacity: 0; } 8% { opacity: .9; } 90% { opacity: .9; } 100% { transform: translate(var(--drift), 108vh) rotate(var(--spin)); opacity: 0; } }
			@keyframes run { from { transform: translateX(-30vw); } to { transform: translateX(110vw); } }
			@keyframes hop { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
			@keyframes paw { 0%, 8% { opacity: 0; } 12% { opacity: .55; } 60% { opacity: .3; } 85%, 100% { opacity: 0; } }
			@media (prefers-reduced-motion: reduce) { .tj { display: none; } }
		</style>
		<div class="tj" aria-hidden="true">
			@for (const style of cheese) {
				<div class="cheese" style={style}>{"🧀"}</div>
			}
			@for (const style of hearts) {
				<div class="heart" style={style}>{"❤️"}</div>
			}
			@for (const style of paws) {
				<div class="paw" style={style}>{"🐾"}</div>
			}
			<div class="run"><span class="mouse">{"🐭"}</span><span class="cat">{"🐱"}</span></div>
		</div>
	</>
}
