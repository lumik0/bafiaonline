import { fromEvents } from "@common/ui";
import type { Assets } from "@common/assets";

/** количество монет с иконкой золота или серебра (картинки игры), без эмодзи */
export function Amount({ value, coin, assets, after = "", size = 16 }: { value: string, coin: "gold" | "silver", assets: Assets, after?: string, size?: number }) @{
	const icon = fromEvents(assets, "change", () => assets.url(coin == "gold" ? "textures/money/dW.png" : "textures/money/RV.png"));

	<>
		<style>
			.amount { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
			.amount img { object-fit: contain; flex: none; }
		</style>
		<span class="amount">{value}<img src={icon()} width={size} height={size} alt={coin == "gold" ? "золото" : "серебро"} />{after}</span>
	</>
}
