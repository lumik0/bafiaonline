/** значок «Б» игрока из Бафии с премиумом: цвет выбирает сам игрок */
export function PremiumBadge({ color, title = "Премиум Бафии" }: { color: string, title?: string }) @{
	<>
		<style>
			.pbadge { display: inline-block; margin-left: 4px; padding: 0 4px; border-radius: 4px; font-size: 10px; font-weight: 700; line-height: 1.5; color: #fff; text-shadow: 0 0 2px rgba(0, 0, 0, .5); }
		</style>
		<span class="pbadge" style={{ background: color }} title={title}>{"Б"}</span>
	</>
}
