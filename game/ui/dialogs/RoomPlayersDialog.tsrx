import { createSignal, onMount } from "@common/ui";
import { Avatar } from "../Avatar.tsrx";
import { enterRoom } from "../../domain/rooms/enter";
import type { RoomItem } from "../../domain/rooms/room";
import type { GameContext } from "../../context";

type Player = { playerObjectId?: string, username?: string, photo?: string, alive?: boolean };

/** кто сейчас в комнате (не заходя в неё) */
export function RoomPlayersDialog({ ctx, room, close }: { ctx: GameContext, room: RoomItem, close: () => void }) @{
	const [players, setPlayers] = createSignal<Player[] | undefined>(undefined);

	onMount(async () => {
		try {
			setPlayers(await ctx.rooms.players(room.id));
		} catch {
			setPlayers([]);
		}
	});

	<>
		<style>
			.list { display: flex; flex-direction: column; gap: 2px; max-height: 300px; overflow-y: auto; }
			.player { display: flex; align-items: center; gap: 8px; padding: 3px 4px; border-radius: 6px; }
			.name { flex: 1; font-size: 14px; }
			.alive { font-size: 12px; }
			.empty { padding: 14px; text-align: center; opacity: .7; }
			.enter { margin-top: 10px; width: 100%; }
		</style>
		<div class="list">
			@if (players() === undefined) {
				<div class="empty">{"Загрузка…"}</div>
			} @else {
				@for (const player of players()!) {
					<div class="player">
						<div onClick={() => ctx.openProfile(player.playerObjectId ?? "")}><Avatar photo={() => player.photo ?? ""} assets={ctx.assets} size={30} /></div>
						<span class="name" data-keep>{player.username ?? ""}</span>
						<span class="alive" style={{ color: player.alive ? "#186400" : "#940000" }}>{player.alive ? "Жив" : "Умер"}</span>
					</div>
				} @empty {
					<div class="empty">{"Пока никого"}</div>
				}
			}
		</div>
		<button class="enter" onClick={() => { close(); void enterRoom(ctx, room.id, room.hasPassword); }}>{"ВОЙТИ"}</button>
	</>
}
