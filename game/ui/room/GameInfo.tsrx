import { fromEvents } from "@common/ui";
import { useKeyboardOpen } from "../keyboard";
import { roleNames, Role } from "../../domain/enums";
import { isMafia } from "../../domain/room/state";
import type { RoomSession } from "../../domain/room/session";
import { YourRoleDialog } from "../dialogs/YourRoleDialog.tsrx";
import type { GameContext } from "../../context";
import { keepFocus } from "../keep-focus";

const ALL_ROLES = Object.values(Role).filter((value): value is Role => typeof value == "number");

/** верхняя панель игры: твоя роль, на кого повлияли роли, счёт команд, таймер, «Сдаться» */
export function GameInfo({ ctx, session, mention }: { ctx: GameContext, session: RoomSession, mention?: (username: string) => void }) @{
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
	// в просмотре чужой игры подпись под ролью - ник того, кто её играл
	const myName = fromEvents(ctx.user, "change", () => session.playerName(ctx.user.username));
	const sky = fromEvents(ctx.settings, "change", () => ctx.settings.data.game.skyAnimation !== false);
	const night = fromEvents(session, "change", () => session.state.inGame && session.state.isNight);
	const hidden = fromEvents(ctx.settings, "change", () => ctx.settings.data.hideUsername);
	const showIndex = fromEvents(ctx.settings, "change", () => ctx.settings.data.game.showIndexPl);
	const showRole = () => void ctx.dialogs.manager.open({ title: "ТВОЯ РОЛЬ", render: close => YourRoleDialog({ ctx, role: info().role as Role, close }) });
	// клавиатура открыта: панель сжимается до одной строки, чтобы были видны сообщения чата
	const typing = useKeyboardOpen();
	const timerColors = { normal: "var(--text-dark)", warning: "orange", danger: "red", critical: "darkred" };

	<>
		<style>
			.info { position: relative; overflow: hidden; display: flex; align-items: stretch; margin: 3px 10px 0; min-height: 124px; box-sizing: border-box; border-radius: 4px; outline: 2px solid rgba(190, 190, 190, .8); background: var(--chat-panel); color: var(--chat-text); }
			.me { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 4px 8px; font-size: 12px; text-align: center; }
			/* ник - отдельная крупная цель нажатия под карточкой роли: не обрезается краем панели и не попадает под карточку */
			.me .nickline { display: block; margin-top: 2px; padding: 5px 10px; min-height: 18px; line-height: 1.2; cursor: pointer; }
			.me img { width: 50px; height: 70px; object-fit: contain; }
			.me .dead { position: absolute; top: 0; left: 0; width: 50px; height: 70px; }
			.picture { position: relative; cursor: pointer; }
			.vote { position: absolute; right: 0; bottom: 4px; padding: 3px; border-radius: 3px; background: red; color: #fff; }
			.blur { filter: blur(5px); }
			.index { color: var(--chat-mention); font-weight: 700; }
			.affected { width: 125px; display: flex; flex-wrap: wrap; align-content: center; gap: 2px; }
			.affected img { width: 28px; height: 40px; object-fit: contain; animation: blink 1s linear alternate infinite; }
			.side { flex: 1; display: flex; flex-direction: column; align-items: flex-end; padding: 6px 8px 2px; font-size: 13px; }
			.mafia { color: #940000; }
			.civil { color: #186400; }
			.timer { font-size: 35px; font-weight: 700; margin-top: 6px; padding: 2px 5px; transition: color 3s; }
			.timer.short { margin-top: 0; }
			.giveup { margin-top: -5px; }
			.info.compact { min-height: 0; margin-top: 2px; }
			.compact .me { flex-direction: row; gap: 6px; padding: 2px 8px; }
			.compact .me img { width: 24px; height: 34px; }
			.compact .me .dead { width: 24px; height: 34px; }
			.compact .me > span { display: none; }
			.compact .me .nickline { display: none; }
			/* вместо счёта команд - роли, которые сейчас действуют на тебя */
			.compact .affected { display: flex; flex: 1; width: auto; min-width: 0; flex-wrap: nowrap; align-content: center; justify-content: center; }
			.compact .affected img { width: 20px; height: 28px; }
			.compact .mafia, .compact .civil { display: none; }
			.compact .side { flex-direction: row; align-items: center; justify-content: flex-end; gap: 10px; padding: 2px 8px; }
			.compact .timer { font-size: 20px; margin: 0; padding: 0 4px; }
			.compact .giveup { margin: 0; padding: 3px 10px; font-size: 12px; }
			.sky { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
			.sky > * { position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%; transition: transform 1.6s ease-in-out, opacity 1.6s; }
			.sun { background: radial-gradient(circle, #fff6a8 0 35%, #ffd23c 36% 100%); box-shadow: 0 0 26px 10px rgba(255, 210, 60, .55); animation: pulse 4s ease-in-out infinite; }
			.moon { background: radial-gradient(circle at 65% 40%, #fff 0 20%, #dfe6f5 21% 100%); box-shadow: 0 0 22px 6px rgba(200, 215, 255, .45), inset -9px -3px 0 0 rgba(120, 135, 175, .35); animation: pulse 5s ease-in-out infinite; }
			.sky .sun { transform: translateY(-140%) scale(.6); opacity: 0; }
			.sky .moon { transform: translateY(140%) scale(.6); opacity: 0; }
			.sky.day .sun { transform: none; opacity: .38; }
			.sky.night .moon { transform: none; opacity: .38; }
			.info > :not(.sky) { position: relative; }
			@keyframes pulse { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.25); } }
			@keyframes blink { from { opacity: 0; } to { opacity: 1; } }
		</style>
		<div class={typing() ? "info compact" : "info"}>
			@if (sky()) {
				<div class={night() ? "sky night" : "sky day"}><div class="sun"></div><div class="moon"></div></div>
			}
			<div class="me">
				<span>{"Твоя роль"}</span>
				// <span>{roleNames[info().role as Role] ?? ""}</span>
				<div class="picture grow" onClick={showRole}>
					<img src={images().roles[info().role]} alt="" />
					@if (!info().alive) {
						<img class="dead" src={images().dead} alt="" />
					}
					@if (info().vote > 0) {
						<div class="vote">{info().vote}</div>
					}
				</div>
				<span class={hidden() ? "nickline blur" : "nickline"} data-keep onMouseDown={keepFocus} onPointerDown={keepFocus} onClick={(event) => { event.stopPropagation(); mention?.(myName()); }}>{showIndex() ? <span class="index">{(info().index + 1) + " "}</span> : null}{myName()}</span>
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
