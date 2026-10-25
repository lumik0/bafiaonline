import { createSignal, onMount } from "@common/ui";
import { roomInfoData } from "../../mods/data";
import type { MenuEntry } from "../../mods/manager";
import type { RoomSession } from "../../domain/room/session";
import type { GameContext } from "../../context";

/** «Настройки» комнаты: кнопки добавляют моды (в официальном - «Рехост») */
export function RoomSettingsDialog({ ctx, session, close }: { ctx: GameContext, session: RoomSession, close: () => void }) @{
	const [entries, setEntries] = createSignal<MenuEntry[] | undefined>(undefined);
	const data = roomInfoData(session);
	onMount(() => void ctx.mods.menuItems("roomSettings", data).then(setEntries));

	<>
		<style>
			.list { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
			.list button { padding: 10px; font-size: 15px; }
			.empty { text-align: center; opacity: .75; padding: 8px 0; }
			.buttons { display: flex; justify-content: flex-end; margin-top: 12px; }
		</style>
		<div class="list">
			@for (const entry of entries() ?? []) {
				<button onClick={() => { close(); ctx.mods.selectMenu(entry, "roomSettings", data); }}>{entry.label}</button>
			} @empty {
				<div class="empty">{entries() ? "Нет доступных настроек" : "Загрузка…"}</div>
			}
		</div>
		<div class="buttons"><button onClick={() => close()}>{"Закрыть"}</button></div>
	</>
}
