import { createSignal, onMount } from "@common/ui";
import { formatDateTime } from "@common/utils/format";
import type { FriendItem } from "../domain/friends";
import { AppBar } from "../ui/AppBar.tsrx";
import { nickStyle, photoRing } from "../domain/decorations";
import { Avatar } from "../ui/Avatar.tsrx";
import type { GameContext } from "../context";
import { enterRoom } from "../domain/rooms/enter";

type Tab = "friends" | "requests" | "search";

/** друзья, заявки и поиск игроков */
export function FriendsScreen({ ctx }: { ctx: GameContext }) @{
	const [tab, setTab] = createSignal<Tab>("friends");
	const [items, setItems] = createSignal<FriendItem[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [failed, setFailed] = createSignal("");
	let query!: HTMLInputElement;

	const load = async (next: Tab, search = "") => {
		setTab(next);
		setFailed("");
		if(next == "search" && !search) {
			setItems([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		try {
			setItems(next == "friends" ? await ctx.friends.friends() : next == "requests" ? await ctx.friends.requests() : await ctx.friends.search(search));
		} catch {
			setFailed("Не удалось загрузить список");
		}
		setLoading(false);
	};
	onMount(() => load("friends"));

	const title = () => tab() == "friends" ? `Друзья (онлайн: ${items().filter(item => item.isOnline).length} из ${items().length})` : "Друзья";
	const status = (item: FriendItem) => tab() == "search" ? (item.isOnline ? "В сети" : "Не в сети") : item.updated ? formatDateTime(item.updated) : "";

	const openProfile = (item: FriendItem) => ctx.openProfile(item.playerObjectId);
	const open = (item: FriendItem) => {
		if(tab() == "search" || !item.friendshipId) openProfile(item);
		else ctx.nav.push("privateChat", { friendshipId: item.friendshipId, playerObjectId: item.playerObjectId, username: item.username, photo: item.photo });
	};

	const accept = async (item: FriendItem) => {
		if(!await ctx.dialogs.confirm("Принять заявку в друзья от этого игрока?", { title: "ПРИНЯТЬ ДРУЖБУ" })) return;
		const result = await ctx.profile.addFriend(item.playerObjectId);
		if(result.status == "listFull") await ctx.dialogs.alert(`Список твоих друзей полон. Ты уже добавил ${result.limit} друзей.\n\nС VIP можно добавить 200 друзей.`);
		else await load(tab());
	};
	const remove = async (item: FriendItem) => {
		if(!await ctx.dialogs.confirm("Удалить этого игрока из друзей? Все личные сообщения тоже будут удалены.", { title: "УДАЛИТЬ ИЗ ДРУЗЕЙ", yes: "Удалить" })) return;
		await ctx.profile.removeFriend(item.playerObjectId);
		setItems(items().filter(other => other.playerObjectId != item.playerObjectId));
	};

	<>
		<style>
			.page { display: flex; flex-direction: column; height: 100%; }
			.tabs { display: flex; gap: 4px; padding: 8px 10px 0; }
			.tabs button { flex: 1; }
			.search { display: flex; gap: 6px; padding: 8px 10px 0; }
			.search input { flex: 1; padding: 8px 10px; user-select: text; -webkit-user-select: text; }
			.list { flex: 1; overflow-y: auto; padding: 6px 10px 10px; display: flex; flex-direction: column; gap: 6px; }
			.item { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 10px; background: var(--surface); cursor: pointer; }
			.photo { position: relative; flex: none; }
			.online { position: absolute; right: -2px; bottom: -2px; width: 14px; height: 14px; box-sizing: border-box; border: 2px solid #fff; border-radius: 50%; background: #636363; }
			.online.on { background: #3fe33f; }
			.info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
			.name { font-size: 14px; color: var(--text-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
			.status { font-size: 11px; color: var(--text-dark); opacity: .75; }
			.actions { display: flex; align-items: center; gap: 6px; }
			.badge { font-size: 12px; padding: 2px 6px; border-radius: 10px; background: var(--accent); color: #fff; }
			.actions button { padding: 4px 10px; font-size: 13px; }
			.empty { padding: 30px 10px; text-align: center; opacity: .7; }
		</style>
		<div class="page">
			<AppBar title={title()} onBack={() => ctx.nav.pop()} />
			<div class="tabs">
				<button class={tab() == "friends" ? "" : "dark-gray"} onClick={() => load("friends")}>{"Друзья"}</button>
				<button class={tab() == "requests" ? "" : "dark-gray"} onClick={() => load("requests")}>{"Запросы"}</button>
				<button class={tab() == "search" ? "" : "dark-gray"} onClick={() => load("search")}>{"Поиск"}</button>
			</div>
			@if (tab() == "search") {
				<form class="search" onSubmit={(event) => { event.preventDefault(); void load("search", query.value.trim()); }}>
					<input ref={query} placeholder="Ник игрока" />
					<button type="submit">{"Найти"}</button>
				</form>
			}
			<div class="list">
				@if (loading()) {
					<div class="empty">{"Загрузка…"}</div>
				} @else if (failed()) {
					<div class="empty">{failed()}</div>
				} @else {
					@for (const item of items()) {
						<div class="item" onClick={() => open(item)}>
							<div class="photo" onClick={(event) => { event.stopPropagation(); openProfile(item); }}>
								<Avatar photo={() => item.photo ?? ""} ring={() => photoRing(item.decorations)} assets={ctx.assets} size={42} />
								<div class={item.isOnline ? "online on" : "online"}></div>
							</div>
							<div class="info">
								<span class="name"><span data-keep style={nickStyle(item.decorations)}>{item.username}</span></span>
								<span class="status">{status(item)}</span>
							</div>
							<div class="actions" onClick={(event) => event.stopPropagation()}>
								@if (item.newMessages > 0) {
									<span class="badge">{item.newMessages}</span>
								}
								@if (item.roomId) {
									<button onClick={() => void enterRoom(ctx, item.roomId!, ctx.rooms.get(item.roomId!)?.hasPassword ?? false)}>{"В комнате"}</button>
								}
								@if (item.incoming) {
									<button onClick={() => void accept(item)}>{"Принять"}</button>
								}
								@if (tab() != "search") {
									<button class="dark-gray" onClick={() => void remove(item)} aria-label="Удалить">{"×"}</button>
								}
							</div>
						</div>
					} @empty {
						<div class="empty">{tab() == "search" ? "Введи ник игрока" : tab() == "friends" ? "Пока нет друзей" : "Нет заявок"}</div>
					}
				}
			</div>
		</div>
	</>
}
