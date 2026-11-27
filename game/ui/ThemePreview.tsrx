import { createSignal } from "@common/ui";
import type { RoomItem } from "../domain/rooms/room";
import { demoRoomSession, setDemoNight } from "../domain/room/demo";
import { sessionDeps } from "../domain/room/deps";
import { Menu } from "../screens/Menu.tsrx";
import type { MenuActions } from "../screens/menu-actions";
import { RoomScreen } from "../screens/RoomScreen.tsrx";
import { AppBar } from "./AppBar.tsrx";
import { RoomCard } from "./RoomCard.tsrx";
import type { GameContext } from "../context";

const rooms: RoomItem[] = [
	{ id: "1", title: "Новички", minLevel: 1, minPlayers: 6, maxPlayers: 15, roles: [2, 7, 10, 11], hasPassword: false, vip: false, friendsInRoom: 1, playersNum: 8, status: 0, myStatus: 2 },
	{ id: "2", title: "Скоро начнём", minLevel: 3, minPlayers: 8, maxPlayers: 15, roles: [2, 7, 9, 5], hasPassword: false, vip: false, friendsInRoom: 0, playersNum: 12, status: 1, myStatus: 2 },
	{ id: "3", title: "Ночная игра", minLevel: 5, minPlayers: 8, maxPlayers: 15, roles: [2, 10, 11, 6, 8], hasPassword: true, vip: false, friendsInRoom: 0, playersNum: 10, status: 3, myStatus: 0 }
];

const none = () => {};
const actions: MenuActions = { rooms: none, competitive: none, chat: none, friends: none, backpack: none, ratings: none, feedback: none, rules: none, history: none, shop: none, settings: none, profile: none, changePhoto: none, telegram: none };

/** пример экранов с текущей темой: настоящие меню и комната (с выдуманными данными), список комнат; цвета меняются сразу */
export function ThemePreview({ ctx, close }: { ctx: GameContext, close: () => void }) @{
	const [tab, setTab] = createSignal("menu");
	const [night, setNight] = createSignal(true);
	const session = demoRoomSession(sessionDeps(ctx), true);
	const TABS = [["menu", "Меню"], ["rooms", "Комнаты"], ["room", "Комната"]] as const;
	const toggleNight = () => { setNight(!night()); setDemoNight(session, night()); };

	<>
		<style>
			.overlay { position: absolute; inset: 0; z-index: 5; display: flex; flex-direction: column; background: var(--screen-bg, var(--bg)); }
			.top { flex: none; display: flex; align-items: center; gap: 6px; padding: 8px 10px; background: var(--surface); }
			.top button { padding: 6px 12px; font-size: 14px; }
			.top .on { background: var(--accent); color: #fff; }
			.top .spacer { flex: 1; }
			/* пример только для просмотра: нажатия внутри него ничего не делают */
			.screen { flex: 1; min-height: 0; position: relative; overflow: hidden; pointer-events: none; }
			.fill { height: 100%; display: flex; flex-direction: column; }
			.list { flex: 1; overflow: hidden; display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; }
		</style>
		<div class="overlay">
			<div class="top">
				@for (const [id, title] of TABS) {
					<button class={tab() == id ? "on" : ""} onClick={() => setTab(id)}>{title}</button>
				}
				@if (tab() == "room") {
					<button onClick={toggleNight}>{night() ? "Ночь" : "День"}</button>
				}
				<span class="spacer"></span>
				<button onClick={close}>{"Закрыть"}</button>
			</div>
			<div class="screen">
				@if (tab() == "menu") {
					<div class="fill"><Menu user={ctx.user} assets={ctx.assets} settings={ctx.settings} actions={actions} bafia={ctx.bafia} /></div>
				}
				@if (tab() == "rooms") {
					<div class="fill">
						<AppBar title="Комнаты" onBack={none} />
						<div class="list">
							@for (const room of rooms) {
								<RoomCard ctx={ctx} room={room} open={none} />
							}
						</div>
					</div>
				}
				@if (tab() == "room") {
					<div class="fill"><RoomScreen ctx={ctx} session={session} /></div>
				}
			</div>
		</div>
	</>
}
