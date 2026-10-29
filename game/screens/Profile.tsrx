import { createSignal, fromEvents, onMount } from "@common/ui";
import { formatNumber } from "@common/utils/format";
import type { PlayerProfile } from "../domain/profile";
import { Role, Sex } from "../domain/enums";
import { Avatar } from "../ui/Avatar.tsrx";
import { Lottie } from "../ui/Lottie.tsrx";
import { PremiumBadge } from "../ui/PremiumBadge.tsrx";
import { premiumFrame } from "../domain/premium-style";
import { AvatarView } from "../ui/dialogs/AvatarView.tsrx";
import { animationOf, DecorationType, normalizeDecorations, nickStyle, photoRing, profileColors, readableOn } from "../domain/decorations";
import { profileData } from "../mods/data";
import { enterRoom } from "../domain/rooms/enter";
import { toRoom } from "../domain/rooms/room";
import { RoomCard } from "../ui/RoomCard.tsrx";
import type { ProfileSection } from "../mods/manager";
import type { GameContext } from "../context";

const rankOf = (level: number) => Math.min(8, Math.max(1, Math.round(level / 2)));
const roleIds = Object.values(Role).filter((value): value is Role => typeof value == "number");

/** содержимое окна «Профиль»: свой или чужой профиль (из чата, друзей, списка игроков) */
export function Profile({ ctx, playerObjectId, close }: { ctx: GameContext, playerObjectId: string, close: () => void }) @{
	const [state, setState] = createSignal<"loading" | "failed" | PlayerProfile>("loading");

	const load = async () => {
		setState("loading");
		setState(await ctx.profile.loadProfile(playerObjectId) ?? "failed");
	};
	onMount(load);

	<>
		<style>
			.state { padding: 30px 20px; text-align: center; opacity: .8; color: var(--text-dark); }
		</style>
		@if (state() == "loading") {
			<div class="state">{"Загрузка профиля…"}</div>
		} @else if (state() == "failed") {
			<div class="state">
				<p>{"Не удалось загрузить профиль"}</p>
				<button onClick={load}>{"Повторить"}</button>
			</div>
		} @else {
			<ProfileBody ctx={ctx} profile={state() as PlayerProfile} playerObjectId={playerObjectId} reload={load} close={close} />
		}
	</>
}

function ProfileBody({ ctx, profile, playerObjectId, reload, close }: { ctx: GameContext, profile: PlayerProfile, playerObjectId: string, reload: () => Promise<void>, close: () => void }) @{
	const player = profile.user;
	const room = profile.room ? toRoom(profile.room) : undefined;
	/** история ников от сервера Бафии: только то, что увидели хотя бы двое игроков Бафии */
	const showNicks = async () => {
		const names = await ctx.bafia.nicks(player.playerObjectId ?? playerObjectId);
		const date = (time: number) => new Date(time).toLocaleDateString("ru-RU");
		await ctx.dialogs.alert(
			!names ? "Сервер Бафии сейчас недоступен." : names.length ? names.map(record => `${record.nick} - ${date(record.first)}${record.last - record.first > 86_400_000 ? " … " + date(record.last) : ""}`).join("\n") : "Пока ничего нет: ники попадают сюда, когда их увидят хотя бы двое игроков Бафии.",
			{ title: "ИСТОРИЯ НИКОВ" }
		);
	};
	const isMe = (player.playerObjectId ?? playerObjectId) == ctx.user.playerObjectId;
	const decorations = normalizeDecorations(profile.decorations);
	const colors = profileColors(decorations);
	const data = profileData(profile, player.playerObjectId ?? playerObjectId, isMe);
	// расширенную статистику добавляют моды (официальный): она приходит чуть позже основной
	const [sections, setSections] = createSignal<ProfileSection[]>([]);
	onMount(() => void ctx.mods.profileSections(data).then(setSections));
	// премиум Бафии: спрашиваем сервер, в Бафии ли этот игрок и какой у него значок (если сервер включён)
	const bafiaVersion = fromEvents(ctx.bafia, "change", () => ({}));
	const premiumColor = () => { bafiaVersion(); return ctx.bafia.premiumColor(player.playerObjectId ?? playerObjectId); };
	onMount(() => ctx.bafia.watch([{ id: player.playerObjectId ?? playerObjectId, nick: player.username ?? "" }]));
	const friendship = typeof profile.friendship == "string" ? profile.friendship : undefined;
	const flag = profile.friendshipFlag;
	const level = player.level ?? 1;
	const progress = player.nextLevelExperience ? Math.min(100, (player.experience ?? 0) / player.nextLevelExperience * 100) : 0;

	const images = fromEvents(ctx.assets, "change", () => ({
		trophy: ctx.assets.url("textures/ui/a1.webp"),
		gold: ctx.assets.url("textures/money/dW.png"),
		sliver: ctx.assets.url("textures/money/RV.png"),
		rank: ctx.assets.url(`textures/rank/rank${rankOf(level)}_36.png`),
		roles: Object.fromEntries(roleIds.map(role => [role, ctx.assets.url(`textures/roles/${role}.png`)])) as Record<number, string>
	}));
	// заглушка по постоянному id пользователя: playerObjectId в каждой игре новый
	const userId = player.objectId;
	const isMuted = fromEvents(ctx.settings, "change", () => !!userId && ctx.settings.data.muted.includes(userId));
	const toggleMute = () => userId && ctx.settings.update(settings => {
		settings.muted = settings.muted.includes(userId) ? settings.muted.filter(id => id != userId) : [...settings.muted, userId];
	});
	const hidden = fromEvents(ctx.settings, "change", () => ctx.settings.data.hideUsername && isMe);

	/** подтвердить, выполнить действие с дружбой и перезагрузить профиль, чтобы кнопки обновились */
	const friendAction = async (question: string, title: string, action: () => Promise<{ status: string, limit?: number } | void>) => {
		if(!await ctx.dialogs.confirm(question, { title })) return;
		try {
			const result = await action();
			if(result && result.status == "listFull") {
				await ctx.dialogs.alert(`Список твоих друзей полон. Ты уже добавил ${result.limit} друзей.\n\nС VIP можно добавить 200 друзей. Освободи список, чтобы добавить новых.`);
				return;
			}
			await reload();
		} catch(error) {
			await ctx.dialogs.alert(error instanceof Error ? error.message : String(error), { title: "Ошибка" });
		}
	};

	<>
		<style>
			.profile { display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--text-dark); }
			.level { display: flex; align-items: center; gap: 8px; width: 100%; }
			.levelbar { flex: 1; display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-radius: 8px; background: var(--surface); }
			.levelbar img { width: 22px; height: 22px; }
			.chip { display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px; border-radius: 8px; background: var(--surface); font-size: 14px; font-weight: 600; white-space: nowrap; }
			.gender { font-size: 20px; line-height: 1; padding: 4px 10px; }
			.hero { position: relative; isolation: isolate; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; width: 100%; }
			.hero .left { display: flex; align-items: flex-end; align-self: end; justify-content: flex-start; }
			.hero .right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; align-self: start; }
			.trophy { font-style: normal; }
			.coin { width: 16px; height: 16px; border-radius: 50%; display: inline-block; }
			.silver { background: radial-gradient(circle at 35% 35%, #fff, #9aa 70%); }
			.gold { background: radial-gradient(circle at 35% 35%, #fff3b0, #e0a800 70%); }
			.bar { position: relative; flex: 1; height: 16px; border-radius: 8px; background: var(--progress-track); overflow: hidden; }
			.fill { position: absolute; inset: 0 auto 0 0; background: var(--progress-fill); }
			.bar span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #111; }
			.photo { position: relative; cursor: pointer; }
			.online { position: absolute; left: 2px; top: 6px; width: 18px; height: 18px; box-sizing: border-box; border: 2px solid #fff; border-radius: 50%; background: #636363; }
			.online.on { background: #3fe33f; }
			.name { font-size: 18px; font-weight: 700; user-select: text; -webkit-user-select: text; }
			.blur { filter: blur(5px); }
			.actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
			h4 { margin: 8px 0 0; font-size: 15px; opacity: .9; align-self: center; text-align: center; }
			.stats { width: 100%; display: flex; flex-direction: column; gap: 3px; }
			.stat { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 6px; background: var(--surface); color: var(--text-dark); font-size: 13px; }
			.stat b { font-weight: 600; user-select: text; -webkit-user-select: text; }
			.help { padding: 1px 7px; margin-left: 6px; font-size: 12px; }
			.roles { width: 100%; display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; }
			.role { display: flex; flex-direction: column; align-items: center; padding: 5px; border-radius: 6px; background: var(--surface); color: var(--text-dark); font-size: 12px; }
			.role img { width: 40px; height: 55px; object-fit: contain; }
		</style>
		<div class="profile" style={{ ...(colors.background ? { background: colors.background, padding: "8px", "border-radius": "8px", "--text-dark": readableOn(colors.background) } : {}), ...(colors.main ? { "--progress-fill": colors.main, "--accent": colors.main } : {}) }}>
			<div class="level">
				<span class="chip gender" title={player.sex == Sex.Female ? "Женский" : "Мужской"} style={{ color: player.sex == Sex.Female ? "#d6558d" : "#3a7bd5" }}>{player.sex == Sex.Female ? "♀" : "♂"}</span>
				<div class="levelbar">
					<img src={images().rank} alt="" />
					<span>{level}</span>
					<div class="bar">
						<div class="fill" style={{ width: progress + "%" }}></div>
						<span>{formatNumber(player.experience ?? 0) + " / " + formatNumber(player.nextLevelExperience ?? 0)}</span>
					</div>
				</div>
			</div>

			<div class="hero">
				@if (animationOf(decorations, DecorationType.ProfileAnimation)) {
					<Lottie animation={() => animationOf(decorations, DecorationType.ProfileAnimation)} />
				}
				<div class="left">
					<span class="chip" title="Рейтинг соревновательного режима"><b class="trophy"><img src={images().trophy} width="15" alt="" /></b>{player.matchMakingScore ?? 0}</span>
					// <span class="chip" title="Рейтинг"><b class="trophy">{"🏆"}</b>{player.matchMakingScore ?? 0}</span>
				</div>
				<div class="photo" onClick={() => void ctx.dialogs.manager.open({ title: player.username, render: () => AvatarView({ photo: player.photo, assets: ctx.assets }) })}>
					<Avatar photo={() => player.photo ?? ""} ring={() => photoRing(decorations)} animation={() => animationOf(decorations, DecorationType.PhotoBorderAnimation)} assets={ctx.assets} size={110} />
					<div class={player.isOnline ? "online on" : "online"}></div>
				</div>
				<div class="right">
					@if (profile.coins) {
						<>
							<span class="chip"><img src={images().sliver} width="16" height="14" alt="" />{formatNumber(profile.coins.silver ?? 0)}</span>
							@if (typeof profile.coins.gold == "number") {
								<span class="chip"><img src={images().gold} width="16" height="14" alt="" />{formatNumber(profile.coins.gold)}</span>
							}
						</>
					}
				</div>
			</div>
			<div class={hidden() ? "name blur" : "name"} data-keep style={{ position: "relative", isolation: "isolate", ...nickStyle(decorations), ...premiumFrame(premiumColor()) }}>
				@if (animationOf(decorations, DecorationType.UsernameAnimation)) {
					<Lottie animation={() => animationOf(decorations, DecorationType.UsernameAnimation)} inset="-15% -10%" />
				}
				{player.username ?? ""}
				{premiumColor() ? <PremiumBadge color={premiumColor()!} /> : null}
			</div>

			<div class="actions">
				@if (ctx.bafia.enabled) {
					<button onClick={() => void showNicks()}>{"История ников"}</button>
				}
				@if (!isMe) {
					<>
					@if (userId) {
					<button class={isMuted() ? "dark-gray" : ""} onClick={toggleMute}>{isMuted() ? "Включить звук" : "Заглушить"}</button>
					}
					@if (!friendship && !flag) {
						<button onClick={() => void friendAction("Отправить этому игроку заявку в друзья?", "ДОБАВИТЬ В ДРУЗЬЯ", () => ctx.profile.addFriend(playerObjectId))}>{"Добавить в друзья"}</button>
					} @else if (flag == 2) {
						<button onClick={() => void friendAction("Принять заявку в друзья от этого игрока?", "ПРИНЯТЬ ДРУЖБУ", () => ctx.profile.addFriend(playerObjectId))}>{"Принять дружбу"}</button>
					} @else if (flag == 1) {
						<button onClick={() => void friendAction("Отменить запрос дружбы?", "ОТМЕНИТЬ ЗАПРОС", () => ctx.profile.removeFriend(playerObjectId))}>{"Отменить запрос"}</button>
					} @else if (flag == 3) {
						<>
						<button onClick={() => void friendAction("Удалить этого игрока из друзей? Личные сообщения тоже будут удалены.", "УДАЛИТЬ ИЗ ДРУЗЕЙ", () => ctx.profile.removeFriend(playerObjectId))}>{"Отменить дружбу"}</button>
						<button onClick={() => friendship && (close(), ctx.nav.push("privateChat", { friendshipId: friendship, playerObjectId, username: player.username ?? "", photo: player.photo }))}>{"Личные сообщения"}</button>
						</>
					}
					</>
				}
			</div>

			@if (room) {
				<>
					<h4>{"Сейчас играет в комнате"}</h4>
					<RoomCard ctx={ctx} room={room} open={() => { close(); void enterRoom(ctx, room.id, room.hasPassword); }} />
				</>
			}

			<h4>{"Статистика"}</h4>
			<div class="stats">
				<div class="stat"><span>{"Сыграно игр"}</span><b>{player.playedGames ?? 0}</b></div>
				<div class="stat"><span>{"Побед за Мафию"}</span><b>{player.winsAsMafia ?? 0}</b></div>
				<div class="stat"><span>{"Побед за Мирных"}</span><b>{player.winsAsPeaceful ?? 0}</b></div>
			</div>

			@for (const section of sections()) {
				<>
					<h4>{section.modName}</h4>
					<div class="stats">
						@for (const row of section.rows) {
							<div class="stat">
								<span>{row.label}</span>
								<span><b>{row.value}</b>@if (row.button) {<button class="help" onClick={() => ctx.mods.profileAction(section.modId, row.button!.id, data)}>{row.button.text}</button>}</span>
							</div>
						}
					</div>
				</>
			}

			<h4>{"Сыгранные роли"}</h4>
			<div class="roles">
				@for (const role of roleIds) {
					<div class="role"><img src={images().roles[role]} alt="" /><span>{player.roleStatistics?.[role] ?? 0}</span></div>
				}
			</div>
		</div>
	</>
}
