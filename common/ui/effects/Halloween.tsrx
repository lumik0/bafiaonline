const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** частицы заранее случайные, но один раз: пересоздавать их при каждом обновлении незачем */
function make(count: number, build: (index: number) => Record<string, string>) {
	return Array.from({ length: count }, (_, index) => build(index));
}

/** хэллоуин: летучие мыши, призраки, тыквы-фонарики, искры, паутина по углам и мерцающее свечение снизу */
export function Halloween({ light }: { light?: boolean }) @{
	const scale = light ? 0.5 : 1;
	const count = (n: number) => Math.max(1, Math.round(n * scale));

	const bats = make(count(6), () => ({
		"--y": rand(4, 70).toFixed(0) + "vh", "--size": rand(22, 40).toFixed(0) + "px",
		"--dur": rand(14, 26).toFixed(1) + "s", "--delay": "-" + rand(0, 26).toFixed(1) + "s", "--bob": rand(24, 70).toFixed(0) + "px"
	}));
	const ghosts = make(count(4), () => ({
		"--x": rand(5, 90).toFixed(0) + "vw", "--size": rand(30, 52).toFixed(0) + "px", "--drift": rand(-12, 12).toFixed(0) + "vw",
		"--dur": rand(18, 32).toFixed(1) + "s", "--delay": "-" + rand(0, 30).toFixed(1) + "s"
	}));
	const pumpkins = make(count(5), () => ({
		"--x": rand(3, 95).toFixed(0) + "vw", "--size": rand(22, 36).toFixed(0) + "px", "--drift": rand(-6, 6).toFixed(0) + "vw",
		"--dur": rand(22, 38).toFixed(1) + "s", "--delay": "-" + rand(0, 38).toFixed(1) + "s"
	}));
	const sparks = make(count(18), () => ({
		"--x": rand(0, 100).toFixed(1) + "vw", "--size": rand(2, 5).toFixed(1) + "px", "--drift": rand(-6, 6).toFixed(0) + "vw",
		"--dur": rand(6, 14).toFixed(1) + "s", "--delay": "-" + rand(0, 14).toFixed(1) + "s"
	}));

	<>
		<style>
			.halloween { position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 9000; }
			.glow { position: absolute; left: 0; right: 0; bottom: 0; height: 28vh; background: radial-gradient(ellipse at 50% 120%, rgba(255, 122, 26, .38), transparent 70%); animation: flicker 3.2s ease-in-out infinite; }
			.web { position: absolute; top: -4px; font-size: 90px; opacity: .3; line-height: 1; filter: grayscale(1) brightness(1.6); }
			.web.left { left: -6px; }
			.web.right { right: -6px; transform: scaleX(-1); }
			.bat { position: absolute; top: var(--y); left: 0; font-size: var(--size); animation: fly var(--dur) linear var(--delay) infinite; will-change: transform; }
			.bat span { display: block; animation: bob 1.1s ease-in-out infinite; }
			.ghost, .pumpkin { position: absolute; left: var(--x); bottom: -60px; font-size: var(--size); opacity: 0; will-change: transform, opacity; }
			.ghost { animation: rise var(--dur) ease-in-out var(--delay) infinite; }
			.pumpkin { animation: rise var(--dur) linear var(--delay) infinite; }
			.pumpkin span { display: block; animation: sway 3s ease-in-out infinite; }
			.spark { position: absolute; left: var(--x); bottom: -10px; width: var(--size); height: var(--size); border-radius: 50%; background: #ffb347; box-shadow: 0 0 8px 2px rgba(255, 140, 40, .8); opacity: 0; animation: rise-spark var(--dur) ease-out var(--delay) infinite; }
			@keyframes fly { from { transform: translateX(-12vw); } to { transform: translateX(112vw); } }
			@keyframes bob { 0%, 100% { transform: translateY(0) rotate(-8deg); } 50% { transform: translateY(-14px) rotate(8deg); } }
			@keyframes rise { 0% { transform: translate(0, 0); opacity: 0; } 10% { opacity: .75; } 85% { opacity: .75; } 100% { transform: translate(var(--drift), -112vh); opacity: 0; } }
			@keyframes rise-spark { 0% { transform: translate(0, 0) scale(1); opacity: 0; } 15% { opacity: 1; } 100% { transform: translate(var(--drift), -70vh) scale(.3); opacity: 0; } }
			@keyframes sway { 0%, 100% { transform: rotate(-10deg); } 50% { transform: rotate(10deg); } }
			@keyframes flicker { 0%, 100% { opacity: .75; } 40% { opacity: 1; } 55% { opacity: .6; } 70% { opacity: .95; } }
			@media (prefers-reduced-motion: reduce) { .halloween { display: none; } }
		</style>
		<div class="halloween" aria-hidden="true">
			<div class="glow"></div>
			<div class="web left">{"🕸"}</div>
			<div class="web right">{"🕸"}</div>
			@for (const style of sparks) {
				<div class="spark" style={style}></div>
			}
			@for (const style of pumpkins) {
				<div class="pumpkin" style={style}><span>{"🎃"}</span></div>
			}
			@for (const style of ghosts) {
				<div class="ghost" style={style}>{"👻"}</div>
			}
			@for (const style of bats) {
				<div class="bat" style={style}><span>{"🦇"}</span></div>
			}
		</div>
	</>
}
