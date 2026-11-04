import { fromEvents } from "@common/ui";
import type { Bafia } from "../domain/bafia";

/** значки нарушителей рядом с ником: «Позор» (много жалоб) и «БАН» (игра не пускает, до конца срока). Видны игрокам Бафии с согласием */
export function Marks({ bafia, nick }: { bafia?: Bafia, nick: () => string }) @{
	const version = bafia ? fromEvents(bafia, "change", () => ({})) : () => 0;
	const shame = () => { version(); return bafia?.shamePoints(nick()); };
	const ban = () => { version(); return bafia?.banUntil(nick()); };
	<>
		<style>
			.mark { display: inline-block; margin-left: 4px; padding: 0 4px; border-radius: 4px; font-size: 10px; font-weight: 700; line-height: 1.5; color: #fff; white-space: nowrap; }
			.mark.shame { background: #6b1a1a; }
			.mark.ban { background: #c0392b; }
		</style>
		{shame() ? <span class="mark shame" title={"Позор: нарушений " + shame()}>{"Позор"}</span> : null}
		{ban() ? <span class="mark ban" title={"В бане до " + new Date(ban()!).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}>{"БАН"}</span> : null}
	</>
}
