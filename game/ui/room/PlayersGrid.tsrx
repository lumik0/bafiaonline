import { createSignal, fromEvents } from "@common/ui";
import { longPress } from "@common/ui/long-press";
import { createViewCache, type PlayerView } from "../../domain/room/views";
import { nickStyle } from "../../domain/decorations";
import { playerMenuData } from "../../mods/data";
import { roleNames, Role } from "../../domain/enums";
import type { RoomSession } from "../../domain/room/session";
import type { GameContext } from "../../context";

const ALL_ROLES = Object.values(Role).filter((value): value is Role => typeof value == "number");

/** стол: карты игроков; нажатие - ход или упоминание, правый клик - меню */
export function PlayersGrid({ ctx, session, mention }: { ctx: GameContext, session: RoomSession, mention: (username: string) => void }) @{
	const cache = createViewCache();
	const views = fromEvents(session, "change", () => cache(session.state).filter(view => !view.isMe));
	const images = fromEvents(ctx.assets, "change", () => ({
		roles: Object.fromEntries([0, ...ALL_ROLES].map(role => [role, ctx.assets.url(`textures/roles/${role}.png`)])) as Record<number, string>,
		marks: Object.fromEntries(ALL_ROLES.map(role => [role, ctx.assets.url(`textures/roles/a${role}.png`)])) as Record<number, string>,
		actions: Object.fromEntries(["_2", "_5", "_6", "_7", "_8", "_9", "check", "kill"].map(name => [name, ctx.assets.url(`textures/roles/${name}.png`)])) as Record<string, string>,
		dead: ctx.assets.url("textures/roles/dead.png")
	}));
	const showIndex = fromEvents(ctx.settings, "change", () => ctx.settings.data.game.showIndexPl);
	const longTap = longPress();

	const press = (view: PlayerView) => view.action ? session.act(view.playerObjectId) : mention(view.username);

	const menu = async (view: PlayerView, event: Event) => {
		event.preventDefault();
		const canMark = view.alive && view.role == 0;
		const core = canMark ? ["Профиль", "Отметить роль"] : ["Профиль"];
		// остальные пункты добавляют моды (авто-клик - из официального)
		const data = playerMenuData(view);
		const extra = await ctx.mods.menuItems("player", data);
		const choice = await ctx.dialogs.choose(event, { title: view.username, labels: [...core, ...extra.map(entry => entry.label)] });
		if(choice === undefined) return;
		if(choice >= core.length) return ctx.mods.selectMenu(extra[choice - core.length]!, "player", data);
		if(choice == 0) ctx.openProfile(view.playerObjectId);
		else if(choice == 1) {
			// список ролей открывается там же, где меню
			const pick = await ctx.dialogs.choose(event, { title: "ОТМЕТИТЬ РОЛЬ", labels: ["Убрать пометку", ...ALL_ROLES.map(role => roleNames[role])] });
			if(pick !== undefined) session.state.markRole(view.playerObjectId, pick == 0 ? undefined : ALL_ROLES[pick - 1]);
		}
	};

	<>
		<style>
			.grid { display: flex; flex-wrap: wrap; justify-content: center; align-content: flex-start; gap: 4px; padding: 4px; }
			.cell { position: relative; width: 50px; height: 100px; text-align: center; cursor: pointer; }
			.cell img { position: absolute; left: 0; top: 0; width: 50px; height: 70px; object-fit: contain; pointer-events: auto; }
			.cell .action { animation: pulse .7s .3s alternate infinite; transform: scale(0); }
			.vote { position: absolute; right: 0; bottom: 30px; padding: 3px; border-radius: 3px; background: red; color: #fff; font-size: 12px; }
			.nick { position: absolute; left: 0; right: 0; top: 70px; font-size: 12px; word-break: break-all; color: var(--chat-name); line-height: 1.15; }
			.index { color: var(--chat-mention); font-weight: 700; }
			@keyframes pulse { from { transform: scale(0); } to { transform: scale(1); } }
		</style>
		<div class="grid">
			@for (const view of views()) {
				<div
					class="cell"
					onClick={() => press(view)}
					onContextMenu={(event) => { event.preventDefault(); if((event as PointerEvent).pointerType != "touch") void menu(view, event); }}
					onPointerDown={(event) => longTap.down(event, () => void menu(view, event))}
					onPointerMove={longTap.move}
					onPointerUp={longTap.cancel}
					onPointerCancel={longTap.cancel}
					onPointerLeave={longTap.cancel}
				>
					<img src={images().roles[view.role]} alt="" draggable={false} />
					@if (!view.alive) {
						<img src={images().dead} alt="" />
					}
					@if (view.role == 0 && view.preRole) {
						<img src={images().marks[view.preRole]} alt="" />
					}
					@if (view.action) {
						<img class="action" src={images().actions[view.action]} alt="" />
					}
					@if (view.vote > 0) {
						<div class="vote">{view.vote}</div>
					}
					<div class="nick" data-keep style={nickStyle(view.decorations)}>{showIndex() ? <span class="index">{(view.index + 1) + " "}</span> : null}{view.username}</div>
				</div>
			}
		</div>
	</>
}
