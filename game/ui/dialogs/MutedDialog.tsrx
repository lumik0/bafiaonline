import { fromEvents } from "@common/ui";
import type { GameContext } from "../../context";

/** заглушённые игроки: их сообщения скрыты только у тебя; кнопка возвращает звук */
export function MutedDialog({ ctx, close }: { ctx: GameContext, close: () => void }) @{
	const list = fromEvents(ctx.settings, "change", () => ctx.settings.data.muted.map(id => ({ id, name: ctx.settings.data.mutedNames[id] || "Игрок" })));
	const unmute = (id: string) => ctx.settings.update(settings => {
		settings.muted = settings.muted.filter(other => other != id);
		delete settings.mutedNames[id];
	});
	<>
		<style>
			.rows { display: flex; flex-direction: column; gap: 6px; max-height: 50vh; overflow-y: auto; }
			.row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; background: rgba(128, 128, 128, .16); }
			.name { flex: 1; min-width: 0; font-size: 14px; overflow-wrap: anywhere; }
			.empty { padding: 14px; text-align: center; opacity: .7; }
			.actions { display: flex; justify-content: flex-end; margin-top: 12px; }
		</style>
		<div class="rows">
			@for (const item of list()) {
				<div class="row">
					<span class="name" data-keep>{item.name}</span>
					<button onClick={() => unmute(item.id)}>{"Вернуть звук"}</button>
				</div>
			} @empty {
				<div class="empty">{"Ты никого не заглушил. Кнопка «Заглушить» есть в профиле игрока."}</div>
			}
		</div>
		<div class="actions"><button class="dark-gray" onClick={close}>{"Закрыть"}</button></div>
	</>
}
