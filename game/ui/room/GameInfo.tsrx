import { fromEvents } from "@common/ui";
import { roleNames, Role } from "../../domain/enums";
import { isMafia } from "../../domain/room/state";
import type { RoomSession } from "../../domain/room/session";
import { YourRoleDialog } from "../dialogs/YourRoleDialog.tsrx";
import type { GameContext } from "../../context";

const ALL_ROLES = Object.values(Role).filter((value): value is Role => typeof value == "number");

/** верхняя панель игры: ваша роль, на кого повлияли роли, счёт команд, таймер, «Сдаться» */
export function GameInfo({ ctx, session }: { ctx: GameContext, session: RoomSession }) @{
	const info = fromEvents(session, "change", () => {
		const state = session.state;
		const me = state.me;
		return {
			role: me?.role ?? 1, alive: me?.alive ?? true, vote: me?.vote ?? 0, affected: me?.affectedByRoles ?? [], index: me?.index ?? 0,
			stat: { ...state.stat }, timer: state.timer, level: state.timerLevel, canGiveUp: state.canGiveUp
		};
	});
	const images = fromEvents(ctx.assets, "change", () => ({
		roles: Object.fromEntries(ALL_ROLES.map(role => [role, ctx.assets.url(`textures/roles/${role}.png`)])) as Record<number, string>,
		dead: ctx.assets.url("textures/roles/dead.png")
	}));
	const myName = fromEvents(ctx.user, "change", () => ctx.user.username);
	const hidden = fromEvents(ctx.settings, "change", () => ctx.settings.data.hideUsername);
	const showIndex = fromEvents(ctx.settings, "change", () => ctx.settings.data.game.showIndexPl);
	const showRole = () => void ctx.dialogs.manager.open({ title: "ВАША РОЛЬ", render: close => YourRoleDialog({ ctx, role: info().role as Role, close }) });
	const timerColors = { normal: "var(--text-dark)", warning: "orange", danger: "red", critical: "darkred" };

	<>
		<style>
			.info { display: flex; align-items: stretch; margin: 5px 10px; min-height: 125px; box-sizing: border-box; border-radius: 4px; outline: 2px solid rgba(190, 190, 190, .8); background: var(--chat-panel); color: var(--chat-text); }
			.me { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 8px; font-size: 12px; text-align: center; }
			.me img { width: 50px; height: 70px; object-fit: contain; }
			.me .dead { position: absolute; top: 0; left: 0; width: 50px; height: 70px; }
			.picture { position: relative; cursor: pointer; }
			.vote { position: absolute; right: 0; bottom: 4px; padding: 3px; border-radius: 3px; background: red; color: #fff; }
			.blur { filter: blur(5px); }
			.index { color: var(--chat-mention); font-weight: 700; }
			.affected { width: 125px; display: flex; flex-wrap: wrap; align-content: center; gap: 2px; }
			.affected img { width: 28px; height: 40px; object-fit: contain; animation: blink 1s linear alternate infinite; }
			.side { flex: 1; display: flex; flex-direction: column; align-items: flex-end; padding: 8px; font-size: 13px; }
			.mafia { color: #940000; }
			.civil { color: #186400; }
			.timer { font-size: 35px; font-weight: 700; margin-top: 12px; padding: 5px; transition: color 3s; }
			.timer.short { margin-top: 0; }
			.giveup { margin-top: -5px; }
			@keyframes blink { from { opacity: 0; } to { opacity: 1; } }
		</style>
		<div class="info">
			<div class="me">
				<span>{"Ваша роль"}</span>
				// <span>{roleNames[info().role as Role] ?? ""}</span>
				<div class="picture" onClick={showRole}>
					<img src={images().roles[info().role]} alt="" />
					@if (!info().alive) {
						<img class="dead" src={images().dead} alt="" />
					}
					@if (info().vote > 0) {
						<div class="vote">{info().vote}</div>
					}
				</div>
				<span class={hidden() ? "blur" : ""} data-keep>{showIndex() ? <span class="index">{(info().index + 1) + " "}</span> : null}{myName()}</span>
			</div>
			<div class="affected">
				@for (const role of info().affected) {
					<img src={images().roles[role]} alt="" />
				}
			</div>
			<div class="side">
				<div class="mafia">{"Мафия: " + (info().stat.mafiaAll ?? 0) + " | " + (info().stat.mafiaAlive ?? 0)}</div>
				<div class="civil">{"Мирные: " + (info().stat.civilianAll ?? 0) + " | " + (info().stat.civilianAlive ?? 0)}</div>
				@if (!session.replay) {
					<div class={info().canGiveUp ? "timer short" : "timer"} style={{ color: timerColors[info().level] }}>{info().timer}</div>
				}
				@if (info().canGiveUp && !session.replay) {
					<button class="giveup" onClick={() => session.giveUp()}>{"Сдаться"}</button>
				}
			</div>
		</div>
	</>
}
