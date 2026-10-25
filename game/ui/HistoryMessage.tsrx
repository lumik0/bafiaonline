import { fromEvents } from "@common/ui";
import type { Bafia } from "../domain/bafia";

/** игра из личного сообщения (`[hist:номер]`); данные грузятся по нажатию */
export function HistoryMessage({ bafia, id, open }: { bafia: Bafia | undefined, id: string, open: ((id: string) => void) | undefined }) @{
	const enabled = bafia ? fromEvents(bafia, "change", () => bafia.enabled) : () => false;

	<>
		<style>
			.note { opacity: .7; font-style: italic; }
			.hist { margin: 2px 0; padding: 6px 12px; border-radius: 8px; }
		</style>
		@if (!bafia || !open) {
			<span>{"[hist:" + id + "]"}</span>
		} @else {
			@if (enabled()) {
				<button class="hist" onClick={() => open(id)}>{"📜 Игра - посмотреть"}</button>
			} @else {
				<span class="note">{"[игра скрыта: ты не согласился на сервер Бафии, включи его в настройках]"}</span>
			}
		}
	</>
}
