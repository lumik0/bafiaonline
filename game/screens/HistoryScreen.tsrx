import { fromEvents } from "@common/ui";
import { longPress } from "@common/ui/long-press";
import { formatDateTime } from "@common/utils/format";
import { HISTORY_NAME_MAX, HISTORY_NOTE_MAX, outcomeOf, recordTitle, type HistoryRecord, type Outcome } from "../domain/history";
import { sessionDeps } from "../domain/room/deps";
import { RoomSession } from "../domain/room/session";
import { roomRank, sortRoles } from "../domain/rooms/room";
import { AppBar } from "../ui/AppBar.tsrx";
import type { GameContext } from "../context";

const ROLE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const OUTCOMES: Record<Outcome, string> = { win: "Победа", lose: "Поражение", draw: "Ничья" };

/** сыгранные игры: открыть для просмотра (стол, роли, переписка) или удалить */
export function HistoryScreen({ ctx }: { ctx: GameContext }) @{
	const records = fromEvents(ctx.history, "change", () => [...ctx.history.data.rooms]);
	const saving = fromEvents(ctx.settings, "change", () => ctx.settings.data.game.saveHistory);
	const images = fromEvents(ctx.assets, "change", () => ({
		roles: Object.fromEntries(ROLE_IDS.map(id => [id, ctx.assets.url(`textures/roles/${id}.png`)])) as Record<number, string>,
		ranks: Object.fromEntries([1, 2, 3, 4, 5, 6].map(rank => [rank, ctx.assets.url(`textures/rank/rank${rank}_36.png`)])) as Record<number, string>
	}));
	const longTap = longPress();

	const outcome = (record: HistoryRecord) => outcomeOf(record, ctx.user.playerObjectId);
	const playersCount = (record: HistoryRecord) => Object.keys(record.playersData ?? {}).length;

	const open = (record: HistoryRecord) => {
		const session = RoomSession.fromHistory(sessionDeps(ctx), record, "history:" + record.createdAt);
		ctx.nav.push("room", { session });
	};

	const remove = async (record: HistoryRecord) => {
		if(!await ctx.dialogs.confirm("Удалить эту игру из истории?", { yes: "Удалить" })) return;
		ctx.history.update(history => { history.rooms = history.rooms.filter(other => other !== record); });
	};

	/** своё название или заметка к игре: пустое значение убирает их (название вернётся к названию комнаты) */
	const setField = (record: HistoryRecord, field: "name" | "note", value: string | undefined) => {
		const text = value?.trim();
		// запись заменяется копией: список перерисовывает только записи с новой ссылкой
		ctx.history.update(history => { history.rooms = history.rooms.map(other => other === record ? { ...other, [field]: text || undefined } : other); });
	};

	const rename = async (record: HistoryRecord) => {
		const value = await ctx.dialogs.prompt({ title: "НАЗВАНИЕ ИГРЫ", text: "Пустое название вернёт название комнаты: «" + (record.title || "Игра") + "».", initial: record.name ?? "", placeholder: record.title || "Название", ok: "Сохранить", validate: text => text.length > HISTORY_NAME_MAX ? "Не длиннее " + HISTORY_NAME_MAX + " символов" : undefined });
		if(value !== undefined) setField(record, "name", value);
	};

	const describe = async (record: HistoryRecord) => {
		const value = await ctx.dialogs.prompt({ title: "ОПИСАНИЕ ИГРЫ", text: "Заметка, которая видна под названием в списке.", initial: record.note ?? "", placeholder: "Например, как играл и что запомнилось", ok: "Сохранить", validate: text => text.length > HISTORY_NOTE_MAX ? "Не длиннее " + HISTORY_NOTE_MAX + " символов" : undefined });
		if(value !== undefined) setField(record, "note", value);
	};

	const menu = async (record: HistoryRecord, event: Event) => {
		event.preventDefault();
		const choice = await ctx.dialogs.choose(event, { title: recordTitle(record), labels: ["Посмотреть", "Переименовать", record.note ? "Изменить описание" : "Добавить описание", "Удалить"] });
		if(choice == 0) open(record);
		else if(choice == 1) await rename(record);
		else if(choice == 2) await describe(record);
		else if(choice == 3) await remove(record);
	};

	<>
		<style>
			.page { display: flex; flex-direction: column; height: 100%; }
			.list { flex: 1; overflow-y: auto; padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 6px; }
			.game { padding: 8px 10px; border-radius: 10px; background: var(--surface); color: var(--text-dark); cursor: pointer; transition: filter .15s; }
			.game:hover { filter: brightness(1.08); }
			.game.win { background: rgba(137, 242, 165, .45); }
			.game.lose { background: rgba(255, 138, 146, .45); }
			.result { text-align: center; font-size: 13px; padding: 2px 0 6px; }
			.head { display: flex; align-items: center; gap: 6px; }
			.head img { width: 24px; height: 24px; flex: none; }
			.title { flex: 1; min-width: 0; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
			.date { font-size: 12px; flex: none; }
			.bottom { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; margin-top: 6px; }
			.roles { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; gap: 2px; }
			.roles img { width: 25px; height: 35px; object-fit: contain; }
			.players { flex: none; padding: 4px 10px; border-radius: 6px; background: rgba(200, 200, 200, .35); font-size: 13px; }
			.origin { font-size: 12px; opacity: .65; padding: 2px 0 0 30px; }
			.note { font-size: 13px; padding: 4px 0 0 30px; opacity: .9; white-space: pre-wrap; overflow-wrap: anywhere; }
			.empty { padding: 40px 14px; text-align: center; opacity: .8; line-height: 1.5; white-space: pre-line; }
		</style>
		<div class="page">
			<AppBar title={"История игр" + (records().length ? " (" + records().length + ")" : "")} onBack={() => ctx.nav.pop()} />
			<div class="list">
				@for (const record of records()) {
					<div
						class={"game" + (outcome(record) == "win" ? " win" : outcome(record) == "lose" ? " lose" : "")}
						onClick={() => open(record)}
						onContextMenu={(event) => { event.preventDefault(); if((event as PointerEvent).pointerType != "touch") void menu(record, event); }}
						onPointerDown={(event) => longTap.down(event, () => void menu(record, event))}
						onPointerMove={longTap.move}
						onPointerUp={longTap.cancel}
						onPointerCancel={longTap.cancel}
						onPointerLeave={longTap.cancel}
					>
						@if (outcome(record)) {
							<div class="result">{OUTCOMES[outcome(record)!]}</div>
						}
						<div class="head">
							<img src={images().ranks[roomRank(record.minLevel ?? 1)]} alt="" />
							<span class="title" data-keep>{recordTitle(record)}</span>
							<span class="date">{formatDateTime(record.createdAt)}</span>
						</div>
						@if (record.name && record.title && record.name.trim() != record.title) {
							<div class="origin" data-keep>{"Комната: " + record.title}</div>
						}
						@if (record.note) {
							<div class="note" data-keep>{record.note}</div>
						}
						<div class="bottom">
							<div class="roles">
								@for (const role of sortRoles(record.selectedRoles ?? [])) {
									<img src={images().roles[role]} alt="" />
								}
							</div>
							<div class="players">{"Игроки: " + playersCount(record) + " [" + record.minPlayers + "/" + record.maxPlayers + "]"}</div>
						</div>
					</div>
				} @empty {
					<div class="empty">{saving() ? "История пуста.\\nСыгранные игры появятся здесь." : "История пуста: сохранение выключено.\\nВключи «Хранить историю после игры» в настройках."}</div>
				}
			</div>
		</div>
	</>
}
