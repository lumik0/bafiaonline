import { fromEvents } from "@common/ui";
import { roomRank, sortRoles, statusText, type RoomItem } from "../domain/rooms/room";
import type { GameContext } from "../context";

const ROLE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** карточка комнаты: уровень, название, статус, роли, игроки; нажатие - вход */
export function RoomCard({ ctx, room, open, menu, players }: {
	ctx: GameContext, room: RoomItem, open: () => void,
	menu?: (event: Event) => void, players?: () => void
}) @{
	const images = fromEvents(ctx.assets, "change", () => ({
		roles: Object.fromEntries(ROLE_IDS.map(id => [id, ctx.assets.url(`textures/roles/${id}.png`)])) as Record<number, string>,
		ranks: Object.fromEntries([1, 2, 3, 4, 5, 6].map(rank => [rank, ctx.assets.url(`textures/rank/rank${rank}_36.png`)])) as Record<number, string>,
		friends: ctx.assets.url("textures/ui/4v.png")
	}));
	let pressTimer: ReturnType<typeof setTimeout> | undefined;

	<>
		<style>
			.room { width: 100%; box-sizing: border-box; align-self: stretch; padding: 8px 10px; border-radius: 10px; background: var(--surface); color: var(--text-dark); cursor: pointer; animation: appear .3s ease; transition: background .15s; text-align: left; }
			.room:hover { filter: brightness(1.08); }
			.room.playing { background: rgba(137, 242, 165, .45); }
			.room.killed { background: rgba(255, 138, 146, .45); }
			.banner { text-align: center; font-size: 13px; padding: 2px 0 6px; }
			.head { display: flex; align-items: center; gap: 6px; }
			.head img { width: 24px; height: 24px; flex: none; }
			.title { flex: 1; min-width: 0; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
			.status { font-size: 12px; flex: none; }
			.bottom { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; margin-top: 6px; }
			.roles { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; gap: 2px; }
			.roles img { width: 25px; height: 35px; object-fit: contain; }
			.players { display: inline-flex; align-items: center; gap: 4px; flex: none; padding: 4px 10px; border-radius: 6px; background: rgba(200, 200, 200, .35); font-size: 13px; }
			.players img { width: 18px; height: 18px; }
			@keyframes appear { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
		</style>
		<div
			class={"room" + (room.myStatus == 0 ? " playing" : room.myStatus == 1 ? " killed" : "")}
			onClick={open}
			onContextMenu={(event) => { if(!menu) return; event.preventDefault(); if((event as PointerEvent).pointerType != "touch") menu(event); }}
			onPointerDown={(event) => { if(menu && event.pointerType == "touch") pressTimer = setTimeout(() => menu(event), 600); }}
			onPointerUp={() => clearTimeout(pressTimer)}
			onPointerLeave={() => clearTimeout(pressTimer)}
		>
			@if (room.myStatus == 0) {
				<div class="banner">{"Ты играешь в этой комнате"}</div>
			} @else if (room.myStatus == 1) {
				<div class="banner">{"Тебя убили в этой комнате"}</div>
			}
			<div class="head">
				<img src={images().ranks[roomRank(room.minLevel)]} alt="" />
				<span class="title" data-keep>{(room.hasPassword ? "🔒 " : "") + (room.vip ? "👑 " : "") + (room.title || "Комната игрока")}</span>
				<span class="status" style={{ color: room.status == 0 ? "green" : "red" }}>{statusText(room.status)}</span>
			</div>
			<div class="bottom">
				<div class="roles">
					@for (const role of sortRoles(room.roles)) {
						<img src={images().roles[role]} alt="" />
					}
				</div>
				<div class="players" onClick={(event) => { if(!players) return; event.stopPropagation(); players(); }}>
					@if (room.friendsInRoom > 0) {
						<img src={images().friends} alt="" />
					}
					<span>{"Игроки: " + room.playersNum + (room.minPlayers ? " [" + room.minPlayers + "/" + room.maxPlayers + "]" : "") + (players ? " ⭣" : "")}</span>
				</div>
			</div>
		</div>
	</>
}
