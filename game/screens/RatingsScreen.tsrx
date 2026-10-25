import { createSignal, onMount } from "@common/ui";
import { formatNumber } from "@common/utils/format";
import { nickStyle, photoRing } from "../domain/decorations";
import { Ratings, ratingModes, ratingsInfo, ratingTypes, type RatingMode, type RatingType, type RatingUser } from "../domain/ratings";
import { AppBar } from "../ui/AppBar.tsrx";
import { Avatar } from "../ui/Avatar.tsrx";
import type { GameContext } from "../context";

/** рейтинги: тип (кубки, опыт, победы, игры, серебро) и период; нажатие на игрока открывает профиль */
export function RatingsScreen({ ctx }: { ctx: GameContext }) @{
	const ratings = new Ratings(ctx.client);
	const [type, setType] = createSignal<RatingType>("matchMakingScore");
	const [mode, setMode] = createSignal<RatingMode>("today");
	const [users, setUsers] = createSignal<RatingUser[] | undefined>(undefined);
	const [failed, setFailed] = createSignal(false);
	/** ответы приходят не по порядку: показываем только последний запрошенный рейтинг */
	let request = 0;

	const load = async () => {
		const mine = ++request;
		setUsers(undefined);
		setFailed(false);
		try {
			const loaded = await ratings.load(type(), mode());
			if(mine == request) setUsers(loaded);
		} catch {
			if(mine == request) setFailed(true);
		}
	};
	onMount(() => void load());

	const pick = (change: () => void) => { change(); void load(); };

	<>
		<style>
			.page { display: flex; flex-direction: column; height: 100%; }
			.tabs { display: flex; gap: 6px; padding: 8px 10px 0; overflow-x: auto; }
			.tabs button { flex: none; padding: 6px 12px; font-size: 14px; background: var(--button-gray-bg); color: var(--button-gray-text); }
			.tabs button.on { background: var(--button-bg); color: var(--button-text); }
			.list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; }
			.row { display: flex; align-items: center; gap: 10px; padding: 5px 8px; border-radius: 8px; background: var(--surface); color: var(--text-dark); cursor: pointer; }
			.place { width: 28px; text-align: center; font-weight: 600; flex: none; }
			.who { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 15px; }
			.value { font-weight: 600; font-size: 15px; }
			.dot { width: 8px; height: 8px; border-radius: 50%; background: #3fe33f; flex: none; }
			.center { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; padding: 20px; opacity: .85; flex-direction: column; gap: 10px; }
		</style>
		<div class="page">
			<AppBar title="Рейтинги" onBack={() => ctx.nav.pop()} right={<button onClick={() => void ctx.dialogs.alert(ratingsInfo, { title: "РЕЙТИНГИ" })} aria-label="О рейтингах">{"?"}</button>} />
			<div class="tabs">
				@for (const item of ratingTypes) {
					<button class={type() == item.id ? "on" : ""} onClick={() => pick(() => setType(item.id))}>{item.label}</button>
				}
			</div>
			<div class="tabs">
				@for (const item of ratingModes) {
					<button class={mode() == item.id ? "on" : ""} onClick={() => pick(() => setMode(item.id))}>{item.label}</button>
				}
			</div>
			@if (users()) {
				<div class="list">
					@for (const [index, user] of users()!.map((user, index) => [index, user] as const)) {
						<div class="row" onClick={() => ctx.openProfile(user.playerObjectId)}>
							<span class="place">{index + 1}</span>
							<Avatar photo={() => user.photo ?? ""} ring={() => photoRing(user.decorations)} assets={ctx.assets} size={34} />
							<span class="who"><span data-keep style={nickStyle(user.decorations)}>{user.username}</span></span>
							@if (user.isOnline) {
								<span class="dot"></span>
							}
							<span class="value">{formatNumber(user.value)}</span>
						</div>
					} @empty {
						<div class="center">{"На данный момент в этом рейтинге нет игроков"}</div>
					}
				</div>
			} @else {
				<div class="center">
					@if (failed()) {
						<>
							<div>{"Не удалось загрузить рейтинг"}</div>
							<button onClick={() => void load()}>{"Повторить"}</button>
						</>
					} @else {
						<div>{"Загрузка…"}</div>
					}
				</div>
			}
		</div>
	</>
}
