import { fromEvents } from "@common/ui";
import { permissions, riskLabels, type Risk } from "@mods/index";
import type { GameContext } from "../../context";

const RISK_COLORS: Record<Risk, string> = { critical: "#e5484d", high: "#f5a524", medium: "#e5c82e", low: "#3dd68c" };

/** разрешения мода: каждое включается и выключается отдельно, мод при этом перезапускается */
export function ModPermissions({ ctx, id, close }: { ctx: GameContext, id: string, close: () => void }) @{
	const items = fromEvents(ctx.mods, "change", () => {
		const mod = ctx.mods.find(id);
		return (mod?.manifest.permissions ?? []).map(permission => ({
			permission, ...permissions[permission], color: RISK_COLORS[permissions[permission].risk], risk: riskLabels[permissions[permission].risk], on: !!mod?.granted.includes(permission)
		}));
	});

	<>
		<style>
			.list { display: flex; flex-direction: column; gap: 4px; max-height: 340px; overflow-y: auto; }
			.perm { display: flex; align-items: center; gap: 8px; padding: 4px 2px; font-size: 13px; }
			.perm input { zoom: 1.3; flex: none; }
			.dot { width: 8px; height: 8px; border-radius: 50%; flex: none; background: var(--c); }
			.text { flex: 1; }
			.risk { font-size: 11px; opacity: .7; }
			.unavailable { opacity: .55; }
			.empty { padding: 12px 0; opacity: .8; }
			.buttons { display: flex; justify-content: flex-end; margin-top: 8px; }
		</style>
		<div class="list">
			@for (const item of items()) {
				<label class={"perm" + (item.available ? "" : " unavailable")} style={{ "--c": item.color }}>
					<input type="checkbox" checked={item.on} onChange={(event) => void ctx.mods.setGranted(id, item.permission, event.currentTarget.checked)} />
					<span class="dot"></span>
					<span class="text">{item.label + (item.available ? "" : " (пока не работает)")}</span>
					<span class="risk">{item.risk}</span>
				</label>
			} @empty {
				<div class="empty">{"Мод не просит разрешений"}</div>
			}
		</div>
		<div class="buttons"><button onClick={() => close()}>{"Закрыть"}</button></div>
	</>
}
