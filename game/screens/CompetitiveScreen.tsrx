import { fromEvents, onCleanup, onMount } from "@common/ui";
import { formatDuration } from "@common/utils/format";
import { nickStyle, photoRing } from "../domain/decorations";
import { banReasons, energyInfo, Matchmaking, matchmakingInfo, MATCH_PLAYERS, SCARCE_ROLE_COUNT, SELECTABLE_ROLES } from "../domain/matchmaking";
import { roleNames, type Role } from "../domain/enums";
import { openMatchmakingRoom } from "../domain/rooms/enter";
import { AppBar } from "../ui/AppBar.tsrx";
import { Avatar } from "../ui/Avatar.tsrx";
import type { GameContext } from "../context";

/** соревновательный режим: поиск игры, принятие, выбор ролей, возврат в начатую игру */
export function CompetitiveScreen({ ctx }: { ctx: GameContext }) @{
	const match = new Matchmaking(ctx.client);
	const state = fromEvents(match, "change", () => match.state);
	const roles = () => SELECTABLE_ROLES.map(id => ({
		id,
		name: roleNames[id as Role],
		count: state().roleCounts[id] ?? MATCH_PLAYERS,
		selected: state().selectedRoles.includes(id),
		image: ctx.assets.url(`textures/roles/${id}.png`)
	}));

	const rating = fromEvents(ctx.user, "change", () => ctx.user.matchMakingScore);
	const infoText = () => {
		const { phase, found, accepted, online } = state();
		if(phase == "searching") return found === undefined ? "В поиске…" : `Найдено игроков (${found}/${MATCH_PLAYERS})`;
		if(phase == "accepting") return "Приняли: " + accepted;
		return "Сейчас играют: " + online;
	};

	match.on("room", room => openMatchmakingRoom(ctx, room));
	match.on("banned", ban => void ctx.dialogs.alert(
		`${banReasons[ban.reason] ?? "Тип причины: " + ban.reason}\n\nОставшееся время блокировки:\n${formatDuration(ban.seconds)}`,
		{ title: "Поиск игр временно заблокирован" }
	));

	match.on("notice", text => void ctx.dialogs.alert(text, { title: "Соревновательный" }));
	const showInfo = () => void ctx.dialogs.alert(matchmakingInfo, { title: "ОСОБЕННОСТИ СОРЕВНОВАТЕЛЬНОГО РЕЖИМА" });
	const showEnergy = () => void ctx.dialogs.alert(energyInfo, { title: "ЭНЕРГИЯ" });
	const mmss = (seconds: number) => Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");

	onMount(() => match.start());
	onCleanup(() => match.stop());

	<>
		<style>
			.page { display: flex; flex-direction: column; height: 100%; }
			.body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding: 16px; }
			.rating { display: flex; justify-content: center; }
			.podium { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
			.podium-title { text-align: center; font-size: 16px; font-weight: 500; color: var(--text); }
			.place { display: flex; align-items: center; gap: 10px; padding: 4px 8px; border-radius: 8px; background: var(--surface); color: var(--text-dark); cursor: pointer; }
			.place .who { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 15px; }
			.place .points { font-size: 15px; font-weight: 600; }
			.more { background: var(--button-shop-bg); color: var(--button-shop-text); padding: 8px; }
			.energy { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; color: var(--text); }
			.energy .help { padding: 1px 8px; }
			.chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 8px; background: var(--surface); color: var(--text-dark); font-size: 18px; font-weight: 600; }
			.chip b { font-style: normal; }
			.info { font-size: 16px; text-align: center; padding: 10px; border-radius: 8px; background: var(--surface); color: var(--text-dark); margin-top: auto; }
			.actions { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
			.actions button { padding: 12px; font-size: 16px; }
			.role { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 8px; color: var(--text-dark); background: linear-gradient(90deg, var(--surface), #81be81); cursor: pointer; }
			.role.scarce { background: linear-gradient(90deg, var(--surface), #c05656); }
			.role img { width: 30px; height: 42px; object-fit: contain; flex: none; }
			.role input { zoom: 1.6; flex: none; }
			.role .name { flex: 1; }
			.role .count { font-size: 13px; opacity: .8; }
			.center { flex: 1; display: flex; align-items: center; justify-content: center; opacity: .85; }
		</style>
		<div class="page">
			<AppBar title="Соревновательный" onBack={() => ctx.nav.pop()} />
			@if (state().phase == "loading") {
				<div class="center">{"Загрузка…"}</div>
			} @else {
				<div class="body">
					@if (state().phase == "roles") {
						<>
							<div class="info">{"Выбор ролей: " + state().secondsLeft + " с"}</div>
							@for (const role of roles()) {
								<label class={"role" + (role.count <= SCARCE_ROLE_COUNT ? " scarce" : "")}>
									<img src={role.image} alt="" />
									<input type="checkbox" checked={role.selected} onChange={(event) => match.toggleRole(role.id, event.currentTarget.checked)} />
									<span class="name">{role.name}</span>
									<span class="count">{role.count + " / " + MATCH_PLAYERS}</span>
								</label>
							}
						</>
					} @else {
						<>
							<div class="rating"><span class="chip" title="Твой рейтинг"><b>{"🏆"}</b>{rating()}</span></div>
							@if (state().podium.length) {
								<div class="podium">
									<div class="podium-title">{"Сегодня на пьедестале"}</div>
									@for (const user of state().podium) {
										<div class="place" onClick={() => ctx.openProfile(user.playerObjectId)}>
											<Avatar photo={() => user.photo ?? ""} ring={() => photoRing(user.decorations)} assets={ctx.assets} size={34} />
											<span class="who"><span data-keep style={nickStyle(user.decorations)}>{user.username}</span></span>
											<span class="points">{"🏆 " + user.value}</span>
										</div>
									}
								</div>
							}
							<button class="more" onClick={showInfo}>{"Подробнее"}</button>
							@if (state().energy) {
								<div class="energy">
									<span>{"Энергия: " + state().energy!.current + (state().energy!.nextIn ? " (+1 через " + mmss(state().energy!.nextIn!) + ")" : "")}</span>
									<button class="help" onClick={showEnergy} aria-label="Что такое энергия">{"?"}</button>
								</div>
							}
							<div class="info">{infoText()}</div>
							<div class="actions">
								@if (state().phase == "idle") {
									<>
										<button onClick={() => match.search()}>{"Начать поиск"}</button>
										@if (state().canReturn) {
											<button onClick={() => match.returnToGame()}>{"Вернуться в игру"}</button>
										}
									</>
								}
								@if (state().phase == "searching") {
									<button onClick={() => match.cancelSearch()}>{"Отменить поиск"}</button>
								}
								@if (state().phase == "accepting") {
									<button disabled={state().acceptedByMe} onClick={() => match.accept()}>{"Принять (" + state().secondsLeft + ")"}</button>
								}
							</div>
						</>
					}
				</div>
			}
		</div>
	</>
}
