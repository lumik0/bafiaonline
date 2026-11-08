import { createEffect, createSignal, fromEvents, onMount } from "@common/ui";
import { formatNumber } from "@common/utils/format";
import { PHOTO_BASE } from "@common/constants";
import type { PlayerProfile } from "../domain/profile";
import type { RoomSession } from "../domain/room/session";
import { Role, Sex } from "../domain/enums";
import { Avatar } from "../ui/Avatar.tsrx";
import { Lottie } from "../ui/Lottie.tsrx";
import { PremiumBadge } from "../ui/PremiumBadge.tsrx";
import { Marks } from "../ui/Marks.tsrx";
import { avatarFrame, nickEffect, premiumFrame, themeBackground } from "../domain/premium-style";
import { renderProfileCard, shareImage } from "../domain/profile-card";
import { GifMessage } from "../ui/GifMessage.tsrx";
import { AvatarView } from "../ui/dialogs/AvatarView.tsrx";
import { animationOf, DecorationType, normalizeDecorations, nickStyle, photoRing, profileColors, readableOn } from "../domain/decorations";
import { profileData } from "../mods/data";
import { enterRoom } from "../domain/rooms/enter";
import { toRoom } from "../domain/rooms/room";
import { RoomCard } from "../ui/RoomCard.tsrx";
import { RoomPlayersDialog } from "../ui/dialogs/RoomPlayersDialog.tsrx";
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
	// выгнать можно игрока из той комнаты, где ты сидишь, пока она не началась
	const mySession = ctx.nav.top?.name == "room" ? (ctx.nav.top.params as { session?: RoomSession }).session : undefined;
	const canKick = !!(mySession && room && room.id == mySession.roomId && !isMe && !mySession.replay && mySession.state.phase == "registration");
	const kick = async () => {
		if(!await ctx.dialogs.confirm("Начать голосование, чтобы выгнать этого игрока из комнаты?", { yes: "Выгнать" })) return;
		mySession!.kick(player.playerObjectId ?? playerObjectId);
		close();
	};
	const decorations = normalizeDecorations(profile.decorations);
	const colors = profileColors(decorations);
	const data = profileData(profile, player.playerObjectId ?? playerObjectId, isMe);
	// расширенную статистику добавляют моды (официальный): она приходит чуть позже основной
	const [sections, setSections] = createSignal<ProfileSection[]>([]);
	onMount(() => void ctx.mods.profileSections(data).then(setSections));
	// премиум Бафии: спрашиваем сервер, в Бафии ли этот игрок и какой у него значок (если сервер включён)
	const bafiaVersion = fromEvents(ctx.bafia, "change", () => ({}));
	const premiumColor = () => { bafiaVersion(); return ctx.bafia.premiumColor(player.playerObjectId ?? playerObjectId); };
	const gifAvatar = () => { bafiaVersion(); return ctx.bafia.avatar(player.playerObjectId ?? playerObjectId); };
	// баннер и цвет фона профиля (премиум Бафии): видят только игроки Бафии
	const banner = () => { bafiaVersion(); return ctx.bafia.banner(player.playerObjectId ?? playerObjectId); };
	const look = () => { bafiaVersion(); return ctx.bafia.look(player.playerObjectId ?? playerObjectId); };
	const theme = () => themeBackground(look());
	// готовая тема важнее цвета, цвет важнее фона от украшений игры
	const customBackground = () => { bafiaVersion(); return theme()?.background ?? ctx.bafia.profileBg(player.playerObjectId ?? playerObjectId); };
	const background = () => customBackground() ?? colors.background;
	const textColor = () => theme()?.text ?? readableOn(background());
	// избранный игрок: в Бафии это уведомление «зашёл в игру»; заметка - только у тебя
	const watched = fromEvents(ctx.bafia, "change", () => ctx.bafia.isWatched(player.username ?? ""));
	const noteKey = player.objectId;
	const [note, setNote] = createSignal(noteKey ? ctx.settings.data.notes?.[noteKey] ?? "" : "");
	const editNote = async () => {
		if(!noteKey) return;
		const value = await ctx.dialogs.prompt({ title: "ЗАМЕТКА", text: "Видишь только ты, на сервер она не уходит.", initial: note(), placeholder: "Например: хороший мафия", ok: "Сохранить" });
		if(value === undefined) return;
		const text = value.trim().slice(0, 200);
		ctx.settings.update(settings => {
			settings.notes = { ...settings.notes };
			if(text) settings.notes[noteKey] = text; else delete settings.notes[noteKey];
		});
		setNote(text);
	};
	const complain = async (kind: "banner" | "avatar") => {
		if(!await ctx.dialogs.confirm(`Пожаловаться на ${kind == "banner" ? "баннер" : "аватарку"} этого игрока? Если жалоб будет несколько, картинка спрячется до проверки.`, { yes: "Пожаловаться", title: "ЖАЛОБА" })) return;
		const result = await ctx.bafia.report(player.playerObjectId ?? playerObjectId, kind);
		await ctx.dialogs.alert(result == "ok" ? "Спасибо, жалоба отправлена." : result == "slow-down" ? "Слишком много жалоб, попробуй завтра." : result == "nothing" ? "Этой картинки уже нет." : "Сервер Бафии сейчас недоступен.", { title: "Жалоба" });
	};
	/** визитка: картинка со статистикой, баннером и аватаркой для друзей */
	const share = async () => {
		const bg = background();
		const blob = await renderProfileCard({
			nick: player.username ?? "", status: look().status, level, games: player.playedGames ?? 0,
			winsMafia: player.winsAsMafia ?? 0, winsPeaceful: player.winsAsPeaceful ?? 0,
			background: theme() ? (/#[0-9a-f]{6}/gi.exec(theme()!.background) ? theme()!.background.match(/#[0-9a-f]{6}/gi)! : ["#444444"]) : [bg && /^#[0-9a-f]{6}/i.test(bg) ? bg.slice(0, 7) : "#f2f2f2"],
			text: textColor(), banner: banner(), avatar: gifAvatar() ?? (player.photo ? `${PHOTO_BASE}/${player.photo}` : undefined)
		});
		if(!blob) return void await ctx.dialogs.alert("Не получилось нарисовать визитку.", { title: "Ошибка" });
		ctx.bafia.track("feature:profileCard");
		await shareImage(blob, `${player.username ?? "profile"}.png`);
	};
	onMount(() => ctx.bafia.watch([{ id: player.playerObjectId ?? playerObjectId, nick: player.username ?? "" }]));
	// ник в профиле приходит позже запроса: значки по нему запрашиваем, когда ник появился
	createEffect(() => { if(player.username) ctx.bafia.watchNicks([player.username]); });
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
			.hero { box-sizing: border-box; position: relative; isolation: isolate; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; width: 100%; }
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
			.status { max-width: 100%; text-align: center; font-size: 14px; opacity: .9; overflow-wrap: anywhere; user-select: text; -webkit-user-select: text; }
			.note { max-width: 100%; text-align: center; font-size: 13px; opacity: .75; font-style: italic; overflow-wrap: anywhere; }
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
		<div class="profile" style={{ ...(background() ? { background: background(), padding: "8px", "border-radius": "8px", "--text-dark": textColor() } : {}), ...(customBackground() ? { margin: "-14px -16px -16px", padding: "14px 16px 16px", "border-radius": "0" } : {}), ...(colors.main ? { "--progress-fill": colors.main, "--accent": colors.main } : {}) }}>
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

			<div class="hero" style={banner() ? { "background-image": `url("${banner()}")`, "background-size": "cover", "background-position": "center", "border-radius": "10px", padding: "18px 10px", "min-height": "150px" } : undefined}>
				@if (animationOf(decorations, DecorationType.ProfileAnimation)) {
					<Lottie animation={() => animationOf(decorations, DecorationType.ProfileAnimation)} />
				}
				<div class="left">
					<span class="chip" title="Рейтинг соревновательного режима"><b class="trophy"><img src={images().trophy} width="15" alt="" /></b>{player.matchMakingScore ?? 0}</span>
					// <span class="chip" title="Рейтинг"><b class="trophy">{"🏆"}</b>{player.matchMakingScore ?? 0}</span>
				</div>
				<div class="photo" onClick={() => void ctx.dialogs.manager.open({ title: player.username, render: () => AvatarView({ photo: player.photo, assets: ctx.assets, gif: gifAvatar() }) })}>
					<Avatar photo={() => player.photo ?? ""} gif={gifAvatar} ring={() => avatarFrame(look(), photoRing(decorations))} animation={() => animationOf(decorations, DecorationType.PhotoBorderAnimation)} assets={ctx.assets} size={110} />
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
				<span style={nickEffect(look(), premiumColor())}>{player.username ?? ""}</span>
				{premiumColor() ? <PremiumBadge color={premiumColor()!} /> : null}
				<Marks bafia={ctx.bafia} nick={() => player.username ?? ""} />
			</div>

			@if (look().status) {
				<div class="status" data-keep>{look().status}</div>
			}
			@if (look().pin) {
				<GifMessage bafia={ctx.bafia} id={look().pin!} />
			}
			@if (note()) {
				<div class="note" data-keep>{"Заметка: " + note()}</div>
			}

			<div class="actions">
				@if (ctx.bafia.enabled) {
					<button onClick={() => void showNicks()}>{"История ников"}</button>
				}
				<button onClick={() => void share()}>{"Визитка"}</button>
				@if (noteKey) {
					<button onClick={() => void editNote()}>{note() ? "Изменить заметку" : "Заметка"}</button>
				}
				@if (!isMe && ctx.bafia.enabled && player.username) {
					<button onClick={() => ctx.bafia.toggleWatched(player.username ?? "")}>{watched() ? "Не следить" : "Следить"}</button>
				}
				@if (!isMe && ctx.bafia.enabled && banner()) {
					<button class="dark-gray" onClick={() => void complain("banner")}>{"Жалоба на баннер"}</button>
				}
				@if (!isMe && ctx.bafia.enabled && gifAvatar()) {
					<button class="dark-gray" onClick={() => void complain("avatar")}>{"Жалоба на аватарку"}</button>
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
					<RoomCard ctx={ctx} room={room} open={() => { close(); void enterRoom(ctx, room.id, room.hasPassword); }} players={() => void ctx.dialogs.manager.open({ title: "ИГРОКИ В КОМНАТЕ", render: (done) => RoomPlayersDialog({ ctx, room, close: done }) })} />
					@if (canKick) {
						<button onClick={() => void kick()}>{"Выгнать из комнаты"}</button>
					}
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
