import { createSignal, fromEvents, onCleanup, onMount } from "@common/ui";
import { enterRoom } from "../domain/rooms/enter";
import { roomMenuData } from "../mods/data";
import { matchesRoom } from "../domain/rooms/filter";
import { orderRooms, type RoomItem } from "../domain/rooms/room";
import { RoomCard } from "../ui/RoomCard.tsrx";
import { AppBar } from "../ui/AppBar.tsrx";
import { RoomFilterDialog } from "../ui/dialogs/RoomFilterDialog.tsrx";
import { RoomSortDialog } from "../ui/dialogs/RoomSortDialog.tsrx";
import { RoomPlayersDialog } from "../ui/dialogs/RoomPlayersDialog.tsrx";
import type { GameContext } from "../context";

/** список комнат: поиск, фильтр, вход; обновляется на лету */
export function RoomsScreen({ ctx }: { ctx: GameContext }) @{
	const list = ctx.rooms;
	const rooms = fromEvents(list, "change", () => list.rooms);
	const loaded = fromEvents(list, "change", () => list.loaded);
	const filter = fromEvents(ctx.roomFilter, "change", () => ({ ...ctx.roomFilter.data, roles: [...ctx.roomFilter.data.roles], sortRules: ctx.roomFilter.data.sortRules.map(rule => ({ ...rule })) }));
	const [search, setSearch] = createSignal("");
	const visible = () => orderRooms(rooms().filter(room => matchesRoom(room, filter(), search())), filter().sortRules);

	onMount(() => list.open());
	onCleanup(() => list.close());

	const showPlayers = (room: RoomItem) => void ctx.dialogs.manager.open({ title: "ИГРОКИ В КОМНАТЕ", render: (close) => RoomPlayersDialog({ ctx, room, close }) });

	/** меню комнаты (правый клик или долгое нажатие): пункты добавляют моды, например официальный */
	const showMenu = async (room: RoomItem, event: Event) => {
		event.preventDefault();
		const data = roomMenuData(room);
		const entries = await ctx.mods.menuItems("room", data);
		if(!entries.length) return;
		const choice = await ctx.dialogs.choose(event, { title: room.title || "Комната", labels: entries.map(entry => entry.label) });
		if(choice !== undefined) ctx.mods.selectMenu(entries[choice]!, "room", data);
	};

	<>
		<style>
			.page { display: flex; flex-direction: column; height: 100%; }
			.toolbar { display: flex; gap: 6px; padding: 8px 10px 0; }
			.toolbar input { flex: 1; min-width: 0; padding: 7px 10px; }
			.dot { display: inline-block; width: 8px; height: 8px; margin-left: 6px; border-radius: 50%; background: #3fe33f; }
			.list { flex: 1; overflow-y: auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
			.empty { padding: 40px 10px; text-align: center; opacity: .8; }
			.create { margin: 6px 10px 10px; padding: 10px; font-size: 15px; }
		</style>
		<div class="page">
			<AppBar title={"Комнаты (" + visible().length + " из " + rooms().length + ")"} onBack={() => ctx.nav.pop()} />
			<div class="toolbar">
				<input placeholder="Поиск по названию" value={search()} onInput={(event) => setSearch(event.currentTarget.value)} />
				<button onClick={() => void ctx.dialogs.manager.open({ title: "СОРТИРОВКА", render: (close) => RoomSortDialog({ ctx, close }) })}>{"Сортировка"}</button>
				<button onClick={() => void ctx.dialogs.manager.open({ title: "ФИЛЬТР", render: (close) => RoomFilterDialog({ ctx, close }) })}>{"Фильтр"}{filter().enabled ? <span class="dot"></span> : null}</button>
				<button onClick={() => list.refresh()} aria-label="Обновить">{"↻"}</button>
			</div>
			<div class="list">
				@if (!loaded()) {
					<div class="empty">{"Загрузка…"}</div>
				} @else {
					@for (const room of visible()) {
						<RoomCard ctx={ctx} room={room} open={() => void enterRoom(ctx, room.id, room.hasPassword)} menu={(event: Event) => void showMenu(room, event)} players={() => showPlayers(room)} />
					} @empty {
						<div class="empty">{rooms().length ? "Нет комнат под твой запрос" : "Пока нет комнат"}</div>
					}
				}
			</div>
			<button class="create" onClick={() => ctx.nav.push("roomCreation")}>{"Создать комнату"}</button>
		</div>
	</>
}
