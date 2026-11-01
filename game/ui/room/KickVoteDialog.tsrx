import { createEffect, fromEvents } from "@common/ui";
import type { RoomSession } from "../../domain/room/session";

/** окно голосования за исключение игрока: закрывается само, когда голосование закончилось */
export function KickVoteDialog({ session, close }: { session: RoomSession, close: () => void }) @{
	const vote = fromEvents(session, "change", () => session.kickVote);
	const name = () => {
		const id = vote()?.targetPlayerObjectId;
		const { state } = session;
		return (state.playerBy(id) ?? state.lobby.find(player => player.playerObjectId == id))?.username ?? "игрока";
	};
	createEffect(() => { if(!vote() || vote()!.voted) close(); });
	const choose = (value: boolean) => { session.voteKick(value); close(); };

	<>
		<style>
			.box { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; color: var(--text-dark); }
			.timer { font-size: 22px; font-weight: 700; }
			.buttons { display: flex; gap: 8px; width: 100%; }
			.buttons button { flex: 1; padding: 10px 4px; font-size: 15px; }
		</style>
		<div class="box">
			<span data-keep>{"Выгнать " + name() + " из комнаты?"}</span>
			<span class="timer">{vote()?.timer ?? ""}</span>
			<div class="buttons">
				<button disabled={vote()?.voted} onClick={() => choose(true)}>{"Выгнать"}</button>
				<button disabled={vote()?.voted} onClick={() => choose(false)}>{"Не выгонять"}</button>
			</div>
		</div>
	</>
}
