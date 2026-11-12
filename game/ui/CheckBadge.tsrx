/** галочка игрока из Бафии (SVG): фон - цвет игрока; `fire` - горит, только у особых игроков (список на сайте статистики) */
export function CheckBadge({ color, title = "Играет в Бафии", fire = false }: { color: string, title?: string, fire?: boolean }) @{
	<>
		<style>
			.check { display: inline-block; width: 14px; height: 14px; margin-left: 4px; vertical-align: -2px; flex: none; }
			.check svg { display: block; width: 100%; height: 100%; overflow: visible; }
			.check.fire svg { filter: drop-shadow(0 0 3px #ff7a1a); animation: glow 1.4s ease-in-out infinite; }
			.flame { transform-box: fill-box; transform-origin: 50% 100%; animation: flame 0.9s ease-in-out infinite; }
			.flame.b { animation-duration: 0.7s; animation-delay: -.3s; }
			.flame.c { animation-duration: 1.1s; animation-delay: -.6s; }
			@keyframes flame { 0%, 100% { transform: scale(1, 1); opacity: .95; } 35% { transform: scale(.8, 1.25); opacity: 1; } 70% { transform: scale(1.1, .8); opacity: .8; } }
			@keyframes glow { 0%, 100% { filter: drop-shadow(0 0 2px #ff7a1a); } 50% { filter: drop-shadow(0 0 5px #ffb020); } }
			@media (prefers-reduced-motion: reduce) { .check.fire svg, .flame { animation: none; } }
		</style>
		<span class={fire ? "check fire" : "check"} title={title} role="img" aria-label={title}>
			<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
				@if (fire) {
					<>
						<path class="flame b" d="M2.5 1 C.8-1.5 1.6-3.6 2.5-5.5 C3.4-3.6 4.2-1.5 2.5 1Z" fill="#ff7a1a" />
						<path class="flame" d="M8 1 C5.8-2.2 6.8-5 8-8 C9.2-5 10.2-2.2 8 1Z" fill="#ffb020" />
						<path class="flame c" d="M13.5 1 C11.8-1.5 12.6-3.6 13.5-5.5 C14.4-3.6 15.2-1.5 13.5 1Z" fill="#ff5a1a" />
					</>
				}
				<rect width="16" height="16" rx="4.5" fill={color} />
				<path d="M2.9 8.5 L4.7 6.8 L6.7 8.8 L11.3 3.6 L13.2 5.3 L6.7 12.5 Z" fill="#fff" />
			</svg>
		</span>
	</>
}
