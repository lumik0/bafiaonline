import { createSignal, onMount } from "@common/ui";
import { copyText } from "@common/utils/clipboard";
import { roomInfoData } from "../../mods/data";
import type { MenuEntry } from "../../mods/manager";
import type { RoomSession } from "../../domain/room/session";
import type { GameContext } from "../../context";

/** «Настройки» комнаты: кнопки добавляют моды (в официальном - «Рехост») */
export function RoomSettingsDialog({ ctx, session, close }: { ctx: GameContext, session: RoomSession, close: () => void }) @{
	// режим рулетки включён, если в названии комнаты «рулетка» или «позор мафии 2.0»; выключить его можно только у себя
	const [rouletteOn, setRouletteOn] = createSignal(!session.state.rouletteOff);
	const toggleRoulette = (on: boolean) => { setRouletteOn(on); session.state.rouletteOff = !on; session.state.changed(); };
	const [entries, setEntries] = createSignal<MenuEntry[] | undefined>(undefined);
	const data = roomInfoData(session);
	/** создатель закрывает комнату Бафии (бесконечная или скучная игра): все выходят */
	const closeRoom = async () => {
		if(!await ctx.dialogs.confirm("Закончить игру и удалить комнату? Все игроки выйдут из неё.", { yes: "Удалить" })) return;
		close();
		await ctx.bafia.closeRoom();
	};
	onMount(() => void ctx.mods.menuItems("roomSettings", data).then(setEntries));

	<>
		<style>
			.list { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
			.list button { padding: 10px; font-size: 15px; }
			.list button:disabled { opacity: .45; cursor: not-allowed; }
			.id { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
			.id span { flex: 1; min-width: 0; font-size: 13px; opacity: .85; overflow-wrap: anywhere; user-select: text; -webkit-user-select: text; }
			.id b { font-weight: 600; }
			.switch { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; font-size: 15px; }
			.switch input { zoom: 1.4; }
			.hint { font-size: 12px; opacity: .7; text-align: center; }
			.empty { text-align: center; opacity: .75; padding: 8px 0; }
			.buttons { display: flex; justify-content: flex-end; margin-top: 12px; }
		</style>
		<div class="id">
			<span><b>{"ID комнаты: "}</b>{data.id}</span>
			<button onClick={() => void copyText(data.id)}>{"Копировать"}</button>
		</div>
		<div class="id">
			<span><b>{"Ссылка: "}</b>{data.inviteUrl}</span>
			<button onClick={() => { ctx.bafia.track("feature:invite"); void copyText(data.inviteUrl); }}>{"Копировать"}</button>
		</div>
		@if (session.state.rouletteByTitle) {
			<>
				<label class="switch"><span>{"Режим рулетки"}</span><input type="checkbox" checked={rouletteOn()} onChange={(event) => toggleRoulette(event.currentTarget.checked)} /></label>
				<div class="hint" style={{ "margin-bottom": "10px" }}>{"Только для тебя: правила рулетки (мафия не убивает, голос по кругу в «Позоре мафии 2.0») соблюдает твоя игра, остальным она ничего не меняет."}</div>
			</>
		}
		<div class="list">
			@for (const entry of entries() ?? []) {
				<button disabled={!!entry.disabled} onClick={() => { close(); ctx.mods.selectMenu(entry, "roomSettings", data); }}>{entry.label}</button>
			} @empty {
				<div class="empty">{entries() ? "Нет доступных настроек" : "Загрузка…"}</div>
			}
		</div>
		@if (session.bafia?.isHost && session.state.inGame) {
			<div class="list"><button onClick={() => void closeRoom()}>{"Закончить игру и удалить комнату"}</button></div>
		}
		@if (data.playing) {
			<div class="hint">{"Рехост недоступен, пока идёт игра"}</div>
		}
		<div class="buttons"><button onClick={() => close()}>{"Закрыть"}</button></div>
	</>
}
