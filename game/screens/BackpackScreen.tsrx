import { createSignal, onCleanup, onMount } from "@common/ui";
import { formatDuration } from "@common/utils/format";
import { Backpack, itemsWord, vipIconSymbol, type ActiveItem, type BackpackContent } from "../domain/backpack";
import { decorationName } from "../domain/decorations";
import { VIP_ICONS } from "../domain/vip-icons";
import { AppBar } from "../ui/AppBar.tsrx";
import type { GameContext } from "../context";

const ICONS = VIP_ICONS.map((symbol, index) => ({ symbol, index }));

const clock = (seconds: number) => {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${pad(Math.floor(seconds / 3600))}ч. ${pad(Math.floor(seconds % 3600 / 60))}м. ${pad(seconds % 60)}с.`;
};

/** рюкзак: применённые предметы (VIP-значок, срок) и предметы, которые можно применить */
export function BackpackScreen({ ctx }: { ctx: GameContext }) @{
	const backpack = new Backpack(ctx.client);
	const [content, setContent] = createSignal<BackpackContent | undefined>(undefined);
	const [failed, setFailed] = createSignal(false);
	const [busy, setBusy] = createSignal(false);
	const [elapsed, setElapsed] = createSignal(0);
	let loadedAt = Date.now();

	const load = async () => {
		try {
			const loaded = await backpack.load();
			loadedAt = Date.now();
			setElapsed(0);
			setContent(loaded);
			setFailed(false);
		} catch {
			setFailed(true);
		}
	};

	/** действие над предметом: пока идёт запрос, кнопки отключены; после - свежее содержимое с сервера */
	const act = async (action: () => Promise<void>) => {
		if(busy()) return;
		setBusy(true);
		try {
			await action();
			await load();
		} catch {
			await ctx.dialogs.alert("Сервер не ответил. Попробуй ещё раз", { title: "Ошибка" });
		} finally {
			setBusy(false);
		}
	};

	const remove = async (item: { id: string }) => {
		if(await ctx.dialogs.confirm("Выбросить украшение? Его нельзя будет вернуть.", { yes: "Выбросить" })) await act(() => backpack.removeDecoration(item.id));
	};

	const left = (item: ActiveItem) => Math.max(0, item.secondsLeft - elapsed());

	onMount(() => {
		void load();
		const timer = setInterval(() => setElapsed(Math.floor((Date.now() - loadedAt) / 1000)), 1000);
		onCleanup(() => clearInterval(timer));
	});

	<>
		<style>
			.page { display: flex; flex-direction: column; height: 100%; }
			.list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 10px; }
			.card { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: 10px; background: var(--surface); color: var(--text-dark); }
			.card.expired { opacity: .75; }
			.name { font-size: 15px; }
			.row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
			.time { font-size: 13px; opacity: .8; }
			.section { margin-top: 4px; font-size: 13px; opacity: .85; }
			.deco { flex-direction: row; align-items: center; gap: 8px; }
			.grow { flex: 1; min-width: 0; }
			.deco button { padding: 4px 8px; font-size: 13px; flex: none; }
			.swatch { width: 36px; height: 36px; border-radius: 8px; border: 1px solid rgba(0, 0, 0, .35); flex: none; }
			.note { font-size: 12px; opacity: .7; }
			.center { flex: 1; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 10px; opacity: .85; text-align: center; padding: 20px; }
		</style>
		<div class="page">
			<AppBar title="Рюкзак" onBack={() => ctx.nav.pop()} />
			@if (content()) {
				<div class="list">
					@if (content()!.active.length) {
						<div class="section">{"Активные предметы"}</div>
					}
					@for (const item of content()!.active) {
						<div class={"card" + (left(item) <= 0 ? " expired" : "")}>
							<div class="name">{item.kind == "vip" ? "VIP-аккаунт (" + vipIconSymbol(item.icon) + ")" : "Неизвестный предмет"}</div>
							@if (item.kind == "vip" && left(item) > 0) {
								<div class="row">
									<span>{"Значок:"}</span>
									<select
										disabled={busy()}
										value={String(item.icon)}
										onChange={(event) => void act(() => backpack.setIcon(item.id, Number(event.currentTarget.value)))}
									>
										@for (const option of ICONS) {
											<option value={String(option.index)} selected={option.index == item.icon}>{option.index == 0 ? "по умолчанию" : option.symbol}</option>
										}
									</select>
									<button disabled={busy()} onClick={() => void act(() => backpack.setIconHidden(item.id, !item.iconHidden))}>
										{item.iconHidden ? "Показывать значок" : "Скрывать значок"}
									</button>
								</div>
							}
							@if (left(item) > 0) {
								<div class="time">{"Осталось: " + clock(left(item))}</div>
							} @else {
								<div class="row">
									<span class="time">{"Срок закончился"}</span>
									<button disabled={busy()} onClick={() => void act(() => backpack.remove(item.id))}>{"Удалить"}</button>
								</div>
							}
						</div>
					}
					<div class="section">{"У тебя: " + content()!.count + " " + itemsWord(content()!.count)}</div>
					<div class="note">{"Размер: " + content()!.size + " ячеек"}</div>
					@if (content()!.activeDecorations.length) {
						<div class="section">{"Надето"}</div>
					}
					@for (const item of content()!.activeDecorations) {
						<div class="card deco">
							<span class="swatch" style={{ background: item.color ?? "transparent" }}></span>
							<div class="grow">
								<div class="name">{decorationName(item.type)}</div>
								<div class="time">{item.seconds !== undefined ? "Осталось: " + clock(Math.max(0, item.seconds - elapsed())) : ""}</div>
							</div>
							<button disabled={busy()} onClick={() => void act(() => backpack.takeOffDecoration(item.id))}>{"Снять"}</button>
						</div>
					}
					@if (content()!.decorations.length) {
						<div class="section">{"Украшения"}</div>
					}
					@for (const item of content()!.decorations) {
						<div class="card deco">
							<span class="swatch" style={{ background: item.color ?? "transparent" }}></span>
							<div class="grow">
								<div class="name">{decorationName(item.type)}</div>
								<div class="time">{item.seconds ? "Действует после надевания: " + formatDuration(item.seconds) : ""}</div>
							</div>
							<button disabled={busy()} onClick={() => void act(() => backpack.activateDecoration(item.id))}>{"Надеть"}</button>
							<button disabled={busy()} onClick={() => void remove(item)}>{"Выбросить"}</button>
						</div>
					}
					@for (const item of content()!.items) {
						<div class="card">
							<div class="name">{"VIP-аккаунт" + (item.seconds ? " на " + formatDuration(item.seconds) : "")}</div>
							<div class="row"><button disabled={busy()} onClick={() => void act(() => backpack.activate(item.id))}>{"Применить"}</button></div>
						</div>
					}
					// <div class="note">{"Не все предметы есть: скоро рюкзак будет обновляться"}</div>
				</div>
			} @else {
				<div class="center">
					@if (failed()) {
						<>
							<div>{"Не удалось загрузить рюкзак"}</div>
							<button onClick={() => { setFailed(false); void load(); }}>{"Повторить"}</button>
						</>
					} @else {
						<div>{"Загрузка…"}</div>
					}
				</div>
			}
		</div>
	</>
}
