import { createSignal, fromEvents, onCleanup, onMount } from "@common/ui";
import { enterRoom } from "../domain/rooms/enter";
import { roomMenuData } from "../mods/data";
import { matchesRoom } from "../domain/rooms/filter";
import { orderRooms, type RoomItem } from "../domain/rooms/room";
import { RoomCard } from "../ui/RoomCard.tsrx";
import { bafiaRoomProblems, openBafiaRoom } from "../domain/rooms/bafia-open";
import { statusColor, statusText } from "../domain/rooms/room";
import type { BafiaRoomInfo } from "@common/bafia/protocol";
import { titleMatches } from "../domain/rooms/title";
import { waitForRoom } from "../ui/room-actions";
import { Icon } from "../ui/Icon.tsrx";
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
	// комнаты, где ты играешь или тебя убили, видны всегда: ни фильтр, ни поиск их не скрывают
	const visible = () => orderRooms(rooms().filter(room => room.myStatus < 2 || matchesRoom(room, filter(), search())), filter().sortRules);

	onMount(() => list.open());
	// сколько игроков Бафии в каких комнатах: обновляется, пока открыт экран
	onMount(() => {
		ctx.bafia.refreshRoomCounts();
		const timer = setInterval(() => ctx.bafia.refreshRoomCounts(), 10_000);
		onCleanup(() => clearInterval(timer));
	});

	// комнаты Бафии: свои комнаты на сервере Бафии (до 50 игроков, свои правила); список обновляется, пока открыт экран
	const [bafia, setBafia] = createSignal<{ rooms: BafiaRoomInfo[], canCreate: boolean, tabs: { official: boolean, bafia: boolean } } | undefined>(undefined);
	const refreshBafia = async () => setBafia(await ctx.bafia.roomList());
	onMount(() => {
		void refreshBafia();
		const timer = setInterval(() => void refreshBafia(), 8000);
		onCleanup(() => clearInterval(timer));
	});
	const watchBafia = async (room: BafiaRoomInfo) => {
		const password = room.hasPassword ? await ctx.dialogs.prompt({ title: "ПАРОЛЬ КОМНАТЫ", text: "У комнаты есть пароль.", placeholder: "Пароль", ok: "Смотреть" }) : undefined;
		if(room.hasPassword && !password) return;
		const result = await ctx.bafia.watchRoom(room.id, password);
		if("error" in result) return void await ctx.dialogs.alert(bafiaRoomProblems[result.error] ?? "Не получилось.", { title: "Комната Бафии" });
		openBafiaRoom(ctx, result.adapter);
	};
	const joinBafia = async (room: BafiaRoomInfo) => {
		const password = room.hasPassword ? await ctx.dialogs.prompt({ title: "ПАРОЛЬ КОМНАТЫ", text: "У комнаты есть пароль.", placeholder: "Пароль", ok: "Войти" }) : undefined;
		if(room.hasPassword && !password) return;
		const result = await ctx.bafia.joinRoom(room.id, password);
		if("error" in result) return void await ctx.dialogs.alert(bafiaRoomProblems[result.error] ?? "Не получилось зайти.", { title: "Комната Бафии" });
		openBafiaRoom(ctx, result.adapter);
	};
	const [picked, setTab] = createSignal<"official" | "bafia">("official");
	// администратор может выключить вкладку, пока она не работает; нет связи с сервером Бафии - обе вкладки
	const allowed = () => bafia()?.tabs ?? { official: true, bafia: true };
	const none = () => !allowed().official && !allowed().bafia;
	const tab = () => (picked() == "official" ? allowed().official : allowed().bafia) ? picked() : allowed().official ? "official" : "bafia";
	const visibleBafia = () => (bafia()?.rooms ?? []).filter(room => !search().trim() || room.title.toLowerCase().includes(search().trim().toLowerCase()));
	onCleanup(() => list.close());

	/** ждать комнату с таким названием и зайти сразу, как только она появится (появившиеся раньше не считаются: на них можно просто нажать) */
	const waitByTitle = async () => {
		const title = (await ctx.dialogs.prompt({ title: "ЖДАТЬ КОМНАТУ", text: "Введи название (или его часть). Как только комната с таким названием появится, игра сразу в неё зайдёт.", placeholder: "Название комнаты", ok: "Ждать", validate: value => value.trim().length < 2 ? "Хотя бы 2 символа" : undefined }))?.trim();
		if(!title) return;
		// пароль заранее: если у комнаты он будет, игра сама введёт его и зайдёт; пустой - значит, комната без пароля или спросим, когда появится
		const password = await ctx.dialogs.prompt({ title: "ПАРОЛЬ КОМНАТЫ", text: "Если у комнаты будет пароль, введи его, и игра зайдёт сама. Если пароля нет, оставь поле пустым.", placeholder: "Пароль (необязательно)", secret: true, ok: "Ждать", cancel: "Назад" });
		if(password === undefined) return;
		await waitForRoom(ctx, `Ждём комнату «${title}»` + (password.trim() ? " (с паролем)" : ""), room => titleMatches(room, title), undefined, password.trim());
	};

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
			.tabs { display: flex; gap: 6px; padding: 8px 10px 0; }
			.tab { flex: 1; padding: 8px; font-size: 14px; opacity: .65; }
			.tab.on { opacity: 1; font-weight: 700; box-shadow: inset 0 -3px 0 var(--accent); }
			.toolbar { display: flex; flex-wrap: var(--toolbar-wrap, nowrap); gap: 6px; padding: 8px 10px 0; }
			.toolbar button { padding-left: var(--toolbar-button-inline, 20px); padding-right: var(--toolbar-button-inline, 20px); flex: var(--toolbar-button-flex, none); }
			.toolbar input { flex: 1 1 var(--toolbar-input-basis, 0%); min-width: 0; padding: var(--toolbar-input-padding, 7px 10px); }
			/* кнопки-значки: квадрат фиксированного размера, чтобы поиск не сжимался до крошки, а "Обновить" не уезжала за край */
			.toolbar .tool { position: relative; flex: none; width: 34px; height: 34px; padding: 0; display: flex; align-items: center; justify-content: center; }
			.toolbar .tool .dot { position: absolute; top: 4px; right: 4px; margin: 0; }
			.toolbar input { min-width: 140px; }
			.dot { display: inline-block; width: 8px; height: 8px; margin-left: 6px; border-radius: 50%; background: #3fe33f; }
			.list { flex: 1; overflow-y: auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
			.empty { padding: 40px 10px; text-align: center; opacity: .8; }
			.create { margin: 6px 10px 10px; padding: 10px; font-size: 15px; }
			.brooms { display: flex; flex-direction: column; gap: 6px; background: transparent; }
			.brooms .row { display: flex; gap: 6px; }
			.brooms .watch { flex: none; padding: 0 12px; font-size: 18px; border-radius: 10px; }
			.brooms .item { flex: 1; min-width: 0; box-sizing: border-box; padding: 8px 10px; border-radius: 10px; background: var(--surface); color: var(--text-dark); cursor: pointer; text-align: left; display: flex; align-items: center; gap: 8px; border-left: 4px solid var(--accent); }
			.brooms .item .name { flex: 1; min-width: 0; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
			.brooms .item .meta { font-size: 12px; opacity: .75; white-space: nowrap; }
			.brooms .item .status { font-size: 12px; flex: none; }
			.brooms .make { padding: 8px; font-size: 14px; }
		</style>
		<div class="page">
			<AppBar title={"Комнаты (" + visible().length + " из " + rooms().length + ")"} onBack={() => ctx.nav.pop()} />
			@if (allowed().official && allowed().bafia) {
				<div class="tabs">
					<button class={tab() == "official" ? "tab on" : "tab"} onClick={() => setTab("official")}>{"Официальные"}</button>
					<button class={tab() == "bafia" ? "tab on" : "tab"} onClick={() => setTab("bafia")}>{"Комнаты Бафии"}</button>
				</div>
			}
			@if (none()) {
				<div class="empty">{"Комнаты временно недоступны. Загляни позже."}</div>
			} @else {
			<>
			<div class="toolbar">
				<input placeholder="Поиск по названию" value={search()} onInput={(event) => setSearch(event.currentTarget.value)} />
				@if (tab() == "official") {
				<>
				<button class="tool" title="Сортировка" aria-label="Сортировка" onClick={() => void ctx.dialogs.manager.open({ title: "СОРТИРОВКА", render: (close) => RoomSortDialog({ ctx, close }) })}><Icon name="sort" size={18} /></button>
				<button class="tool" title="Фильтр" aria-label="Фильтр" onClick={() => void ctx.dialogs.manager.open({ title: "ФИЛЬТР", render: (close) => RoomFilterDialog({ ctx, close }) })}><Icon name="filter" size={18} />{filter().enabled ? <span class="dot"></span> : null}</button>
				<button class="tool" onClick={() => void waitByTitle()} title="Ждать комнату: зайти сразу, когда появится комната с названием" aria-label="Ждать комнату"><Icon name="hourglass" size={18} /></button>
				<button class="tool" onClick={() => list.refresh()} title="Обновить" aria-label="Обновить"><Icon name="refresh" size={18} /></button>
				</>
				} @else {
					<button class="tool" onClick={() => void refreshBafia()} title="Обновить" aria-label="Обновить"><Icon name="refresh" size={18} /></button>
				}
			</div>
			<div class="list">
				@if (tab() == "bafia") {
					<div class="brooms">
						@for (const room of visibleBafia()) {
							<div class="row">
								<button class="item" onClick={() => void joinBafia(room)}>
									<span class="name" data-keep>{(room.hasPassword ? "🔒 " : "") + room.title}</span>
									<span class="meta">{room.host + " · " + room.players + "/" + room.maxPlayers + (room.premium ? " · премиум" : "") + (room.startsIn !== undefined ? " · старт через " + room.startsIn : "")}</span>
									<span class="status" style={{ color: statusColor(room.status) }}>{statusText(room.status)}</span>
								</button>
								<button class="watch" title="Смотреть игру" aria-label="Смотреть игру" onClick={() => void watchBafia(room)}><Icon name="eye" size={18} /></button>
							</div>
						} @empty {
							<div class="empty">{!bafia() ? "Загрузка…" : "Пока нет комнат Бафии"}</div>
						}
					</div>
				} @else if (!loaded()) {
					<div class="empty">{"Загрузка…"}</div>
				} @else {
					@for (const room of visible()) {
						<RoomCard ctx={ctx} room={room} open={() => void enterRoom(ctx, room.id, room.hasPassword)} menu={(event: Event) => void showMenu(room, event)} players={() => showPlayers(room)} />
					} @empty {
						<div class="empty">{rooms().length ? "Нет комнат под твой запрос" : "Пока нет комнат"}</div>
					}
				}
			</div>
			@if (tab() == "official") {
				<button class="create" onClick={() => ctx.nav.push("roomCreation")}>{"Создать комнату"}</button>
			} @else {
				<button class="create" disabled={!bafia()?.canCreate} title={bafia()?.canCreate ? "" : "Создавать комнаты Бафии пока может не каждый"} onClick={() => ctx.nav.push("bafiaRoomCreation")}>{"Создать комнату"}</button>
			}
			</>
			}
		</div>
	</>
}
