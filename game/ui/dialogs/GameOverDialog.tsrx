import { createSignal, onMount } from "@common/ui";
import { formatNumber } from "@common/utils/format";
import { decorationName } from "../../domain/decorations";
import { gameOverData } from "../../mods/data";
import type { MenuEntry } from "../../mods/manager";
import type { RoomSession } from "../../domain/room/session";
import type { GameContext } from "../../context";

const WINNERS = { mafia: "Мафия победила!", peaceful: "Мирные жители победили!", draw: "Ничья" };
const signed = (value: number) => (value > 0 ? "+" : "") + formatNumber(value);

/** награда одной строкой: предмет (rwdi) или украшение (rwdd) */
function rewardText(finish: NonNullable<RoomSession["state"]["finish"]>): string | undefined {
	const item = finish.rewardItem as { itmt?: number } | undefined;
	const decoration = finish.rewardDecoration as { dt?: number } | undefined;
	if(decoration) return decorationName(decoration.dt);
	if(item) return item.itmt === 0 || item.itmt === undefined ? "VIP-аккаунт" : "Предмет";
	return undefined;
}

/** «Игра окончена»: победитель, активность и награда; кнопки добавляют моды */
export function GameOverDialog({ ctx, session, close }: { ctx: GameContext, session: RoomSession, close: () => void }) @{
	const [entries, setEntries] = createSignal<MenuEntry[]>([]);
	const data = gameOverData(session);
	const finish = session.state.finish;
	const reward = finish ? rewardText(finish) : undefined;
	onMount(() => void ctx.mods.menuItems("gameOver", data).then(setEntries));

	<>
		<style>
			.result { text-align: center; font-size: 20px; margin: 6px 0 8px; }
			.team, .activity { text-align: center; font-size: 15px; opacity: .85; margin-bottom: 6px; }
			.rewards { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; margin: 8px 0 10px; }
			.chip { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 64px; padding: 6px 10px; border-radius: 8px; background: rgba(0, 0, 0, .07); font-size: 16px; font-weight: 600; }
			.chip small { font-size: 11px; font-weight: 400; opacity: .7; }
			.reward { text-align: center; font-size: 14px; margin-bottom: 8px; }
			.extra { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 12px; }
			.buttons { display: flex; justify-content: center; }
		</style>
		<div class="result">{data.winner ? WINNERS[data.winner] : "Игра окончена"}</div>
		@if (data.won !== undefined) {
			<div class="team">{data.won ? "Твоя команда победила" : "Твоя команда проиграла"}</div>
		}
		@if (finish?.activity !== undefined) {
			<div class="activity">{"Твоя активность в игре была: " + finish.activity + "%"}</div>
		}
		@if (finish) {
			<div class="rewards">
				@if (finish.experience !== undefined) {
					<div class="chip">{signed(finish.experience)}<small>{"опыт"}</small></div>
				}
				@if (finish.silver !== undefined) {
					<div class="chip">{signed(finish.silver)}<small>{"серебро"}</small></div>
				}
				@if (finish.rating !== undefined) {
					<div class="chip">{signed(finish.rating)}<small>{"рейтинг"}</small></div>
				}
			</div>
		}
		@if (reward) {
			<div class="reward">{"Дополнительная награда: " + reward}</div>
		}
		<div class="extra">
			@for (const entry of entries()) {
				<button onClick={() => { close(); ctx.mods.selectMenu(entry, "gameOver", data); }}>{entry.label}</button>
			}
		</div>
		<div class="buttons"><button onClick={() => close()}>{"OK"}</button></div>
	</>
}
