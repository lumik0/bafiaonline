import { fromEvents } from "@common/ui";
import type { RoomSession } from "../../domain/room/session";

/** кнопки голосования за исключение под сообщением о его начале; пока оно идёт и вы ещё не проголосовали */
export function KickVote({ session, entryId }: { session: RoomSession, entryId: number }) @{
	// кнопки только у последнего сообщения о голосовании: старые остаются просто текстом
	const vote = fromEvents(session, "change", () => {
		const latest = [...session.state.messages.entries].reverse().find(entry => entry.kickVote);
		return latest?.id == entryId ? session.kickVote : undefined;
	});

	<>
		<style>
			.vote { display: flex; flex-direction: column; align-items: center; gap: 4px; margin-top: 4px; }
			.buttons { display: flex; gap: 6px; }
			.timer { font-weight: 700; }
		</style>
		@if (vote()) {
			<span class="vote">
				<span class="timer">{vote()!.timer}</span>
				<span class="buttons">
					<button disabled={vote()!.voted} onClick={() => session.voteKick(true)}>{"Выгнать"}</button>
					<button disabled={vote()!.voted} onClick={() => session.voteKick(false)}>{"Не выгонять"}</button>
				</span>
			</span>
		}
	</>
}
