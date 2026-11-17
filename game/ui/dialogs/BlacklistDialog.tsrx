import { fromEvents } from "@common/ui";
import { addToBlacklist, blacklistLimit, isBlacklisted, removeFromBlacklist, type WhoIs } from "../../domain/blacklist";
import type { GameContext } from "../../context";

const problems = {
	limit: "Список заполнен. С премиумом в него помещается больше игроков.",
	exists: "Этот игрок уже в списке.",
	empty: "Нужен ник игрока."
};

/** чёрный список: кого убрать, кого добавить; `candidates` - игроки комнаты, их можно добавить одним нажатием */
export function BlacklistDialog({ ctx, close, candidates = [] }: { ctx: GameContext, close: () => void, candidates?: WhoIs[] }) @{
	const state = fromEvents(ctx.settings, "change", () => ({ list: [...ctx.settings.data.blacklist], kick: ctx.settings.data.blacklistKick }));
	const premium = fromEvents(ctx.bafia, "change", () => !!ctx.bafia.premiumUntil && ctx.bafia.premiumUntil > Date.now());
	const limit = () => blacklistLimit(premium());

	const save = (list: ReturnType<typeof removeFromBlacklist>) => { ctx.settings.update(data => { data.blacklist = list; }); ctx.bafia.syncBlacklist(); };
	const add = async (who: WhoIs) => {
		const result = addToBlacklist(ctx.settings.data.blacklist, who, limit());
		if("error" in result) return void await ctx.dialogs.alert(problems[result.error], { title: "ЧЁРНЫЙ СПИСОК" });
		save(result.list);
	};
	const addByNick = async () => {
		const nick = await ctx.dialogs.prompt({ title: "В ЧЁРНЫЙ СПИСОК", text: "Ник игрока. Пока ты не встретил его в комнате или профиле, по нику его и узнают.", placeholder: "Ник", ok: "Добавить" });
		if(nick?.trim()) await add({ nick: nick.trim() });
	};
	const free = () => candidates.filter(who => !isBlacklisted(state().list, who));

	<>
		<style>
			.hint { margin: 0 0 10px; font-size: 13px; opacity: .8; }
			.switch { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 0 10px; font-size: 14px; }
			.switch input { zoom: 1.3; }
			h4 { margin: 10px 0 6px; font-size: 13px; opacity: .75; }
			.rows { display: flex; flex-direction: column; gap: 6px; max-height: 34vh; overflow-y: auto; }
			.row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; background: rgba(128, 128, 128, .16); }
			.name { flex: 1; min-width: 0; font-size: 14px; overflow-wrap: anywhere; }
			.empty { padding: 10px; text-align: center; opacity: .7; font-size: 13px; }
			.actions { display: flex; justify-content: space-between; gap: 8px; margin-top: 12px; }
		</style>
		<p class="hint">{`Только официальные комнаты. Кто из списка зашёл в комнату, того сразу пробуют выгнать (голосованием). В списке ${state().list.length} из ${limit()}.`}</p>
		<label class="switch"><span>{"Выгонять автоматически"}</span><input type="checkbox" checked={state().kick} onChange={(event) => ctx.settings.update(data => { data.blacklistKick = event.currentTarget.checked; })} /></label>
		<div class="rows">
			@for (const entry of state().list) {
				<div class="row">
					<span class="name" data-keep>{entry.nick}</span>
					<button class="dark-gray" onClick={() => save(removeFromBlacklist(ctx.settings.data.blacklist, entry))}>{"Убрать"}</button>
				</div>
			} @empty {
				<div class="empty">{"Список пуст"}</div>
			}
		</div>
		@if (free().length) {
			<>
				<h4>{"Игроки в комнате"}</h4>
				<div class="rows">
					@for (const who of free()) {
						<div class="row">
							<span class="name" data-keep>{who.nick}</span>
							<button onClick={() => void add(who)}>{"Добавить"}</button>
						</div>
					}
				</div>
			</>
		}
		<div class="actions">
			<button onClick={() => void addByNick()}>{"Добавить по нику"}</button>
			<button class="dark-gray" onClick={close}>{"Закрыть"}</button>
		</div>
	</>
}
