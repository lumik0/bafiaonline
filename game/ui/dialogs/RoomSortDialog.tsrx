import { fromEvents } from "@common/ui";
import { defaultSortRules, partitionRules, sortCriteria, type SortKey, type SortRule } from "../../domain/rooms/room";
import type { GameContext } from "../../context";

type SortRow = SortRule & { index: number, number: number, first: boolean, last: boolean, firstOff: boolean } & (typeof sortCriteria)[SortKey];

/**
 * сортировка комнат: верхний критерий главнее, его направление меняется
 * ниже - выключенные: поставь галочку, и критерий встанет в конец включённых
 */
export function RoomSortDialog({ ctx, close }: { ctx: GameContext, close: () => void }) @{
	const store = ctx.roomFilter;
	// неизменившаяся строка остаётся тем же объектом, иначе список пересоздавался бы
	let previous = new Map<string, { signature: string, row: SortRow }>();
	const rules = fromEvents(store, "change", () => {
		const next = new Map<string, { signature: string, row: SortRow }>();
		const list = store.data.sortRules;
		const enabled = list.filter(rule => rule.on).length;
		const rows = list.map((rule, index) => {
			const signature = `${rule.on}${rule.desc}${index}${enabled}`;
			const old = previous.get(rule.key);
			// «включён» и «направление» берутся из правила, а не из описания
			const entry = old?.signature == signature ? old : {
				signature,
				row: { ...sortCriteria[rule.key], ...rule, index, number: index + 1, first: index == 0, last: index == enabled - 1, firstOff: index == enabled }
			};
			next.set(rule.key, entry);
			return entry.row;
		});
		previous = next;
		return rows;
	});

	const move = (index: number, step: number) => store.update(data => {
		const target = index + step;
		if(target < 0 || target >= data.sortRules.filter(rule => rule.on).length) return;
		const [rule] = data.sortRules.splice(index, 1);
		data.sortRules.splice(target, 0, rule!);
	});
	const change = (index: number, patch: { on?: boolean, desc?: boolean }) => store.update(data => {
		Object.assign(data.sortRules[index]!, patch);
		data.sortRules = partitionRules(data.sortRules);
	});

	<>
		<style>
			.hint { font-size: 12px; opacity: .75; margin-bottom: 8px; line-height: 1.35; }
			.list { display: flex; flex-direction: column; gap: 4px; max-height: 360px; overflow-y: auto; }
			.sub { font-size: 12px; opacity: .7; margin: 6px 0 0; }
			.rule { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 8px; background: rgba(0, 0, 0, .07); }
			.rule.off { background: transparent; border: 1px dashed rgba(0, 0, 0, .25); }
			.rule input { zoom: 1.3; flex: none; }
			.number { width: 18px; text-align: center; font-size: 14px; font-weight: 600; flex: none; }
			.name { flex: 1; min-width: 0; font-size: 14px; }
			.name small { display: block; font-size: 11px; opacity: .65; }
			.rule button { padding: 3px 8px; font-size: 12px; flex: none; }
			.dir { max-width: 120px; }
			.buttons { display: flex; justify-content: space-between; gap: 8px; margin-top: 10px; }
		</style>
		<div class="hint">{"Комнаты, где ты играешь, всегда сверху. Остальные упорядочиваются по включённым критериям: сначала по первому, а если у комнат одинаково - по второму и так далее."}</div>
		<div class="list">
			@for (const rule of rules()) {
				<>
					@if (rule.index == 0 && rule.on) {
						<div class="sub">{"Включено (чем выше, тем важнее)"}</div>
					}
					@if (rule.firstOff) {
						<div class="sub">{"Не используется - поставь галочку, чтобы включить"}</div>
					}
					<div class={"rule" + (rule.on ? "" : " off")}>
						<input type="checkbox" checked={rule.on} onChange={(event) => change(rule.index, { on: event.currentTarget.checked })} />
						@if (rule.on) {
							<span class="number">{rule.number}</span>
						}
						<span class="name">{rule.label}<small>{rule.hint}</small></span>
						@if (rule.on) {
							<>
								<button class="dir" title="Нажми, чтобы поменять направление" onClick={() => change(rule.index, { desc: !rule.desc })}>{rule.dir[rule.desc ? 1 : 0]}</button>
								<button title="Выше" disabled={rule.first} onClick={() => move(rule.index, -1)}>{"▲"}</button>
								<button title="Ниже" disabled={rule.last} onClick={() => move(rule.index, 1)}>{"▼"}</button>
							</>
						}
					</div>
				</>
			}
		</div>
		<div class="buttons">
			<button onClick={() => store.update(data => { data.sortRules = defaultSortRules(); })}>{"Сбросить"}</button>
			<button onClick={() => close()}>{"Готово"}</button>
		</div>
	</>
}
