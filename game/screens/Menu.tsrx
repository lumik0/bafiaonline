import { fromEvents } from "@common/ui";
import type { Assets } from "@common/assets";
import { formatNumber } from "@common/utils/format";
import { version } from "@common/version";
import type { SettingsStore } from "../domain/settings";
import type { User } from "../domain/user";
import type { Bafia } from "../domain/bafia";
import { AppBar } from "../ui/AppBar.tsrx";
import { animationOf, DecorationType, nickStyle, photoRing } from "../domain/decorations";
import { Avatar } from "../ui/Avatar.tsrx";
import { Lottie } from "../ui/Lottie.tsrx";
import { Icon } from "../ui/Icon.tsrx";
import type { MenuActions } from "./menu-actions";

const rankOf = (level: number) => Math.min(8, Math.max(1, Math.round(level / 2)));

// это дашборд. но лучше меню
export function Menu({ user, assets, settings, actions, bafia }: { user: User, assets: Assets, settings: SettingsStore, actions: MenuActions, bafia?: Bafia }) @{
	// своя gif-аватарка (премиум Бафии)
	const myGif = bafia ? fromEvents(bafia, "change", () => bafia.myAvatarUrl) : () => undefined;
	const me = fromEvents(user, "change", () => ({
		username: user.username, photo: user.photo, decorations: user.decorations, level: user.level, experience: user.experience,
		next: user.nextLevelExperience, gold: user.goldCoins, silver: user.silverCoins, rating: user.matchMakingScore,
		messages: user.newMessages, requests: user.friendRequests
	}));
	const images = fromEvents(assets, "change", () => ({
		backpack: assets.url("textures/ui/2j.png"),
		settings: assets.url("textures/ui/ei.png"),
		profile: assets.url("textures/ui/f-.png"),
		mail: assets.url("textures/ui/0Y.png"),
		request: assets.url("textures/ui/-8.png"),
		trophy: assets.url("textures/ui/a1.webp"),
		gold: assets.url("textures/money/dW.png"),
		sliver: assets.url("textures/money/RV.png"),
		rank: assets.url(`textures/rank/rank${rankOf(user.level)}_36.png`)
	}));
	const hidden = fromEvents(settings, "change", () => settings.data.hideUsername);
	const progress = () => me().next > 0 ? Math.min(100, me().experience / me().next * 100) : 0;

	<>
		<style>
			.menu { position: relative; display: flex; flex-direction: column; height: 100%; overflow: auto; }
			/* версия в левом нижнем углу: игроки присылают скриншоты, и по ним видно, на какой версии играют */
			.version { position: absolute; left: 12px; bottom: 2px; font-size: 11px; line-height: 12px; opacity: .55; pointer-events: none; }
			.content { position: relative; flex: 1; display: flex; flex-direction: column; padding: 10px 12px 14px; gap: 10px; min-height: 480px; }

			.level { display: flex; align-items: center; gap: 8px; }
			.rank { display: flex; align-items: center; gap: 2px; font-weight: 600; min-width: 44px; }
			.rank img { width: 24px; height: 24px; }
			.bar { position: relative; flex: 1; height: 18px; border-radius: 9px; background: var(--progress-track); overflow: hidden; }
			.fill { position: absolute; inset: 0 auto 0 0; background: var(--progress-fill); transition: width .4s ease; }
			.bar span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #111; }
			.square { padding: 0; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 6px; flex: none; }
			.square img { width: 22px; height: 22px; }

			.corners { display: flex; justify-content: space-between; align-items: flex-start; }
			.badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; border-radius: 8px; background: var(--badge-bg); color: var(--badge-text); font-size: 13px; font-weight: 600; }
			.coins { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
			.coin { width: 16px; height: 16px; border-radius: 50%; display: inline-block; }
			.silver { background: radial-gradient(circle at 35% 35%, #fff, #9aa 70%); }
			.gold { background: radial-gradient(circle at 35% 35%, #fff3b0, #e0a800 70%); }

			.hero { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 6px; }
			.photo { position: relative; }
			.camera { position: absolute; left: -6px; bottom: 2px; padding: 4px; width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: var(--badge-bg); color: var(--badge-text); border-color: transparent; }
			.name { font-weight: 700; font-size: 16px; color: var(--text); text-shadow: 0 1px 2px rgba(0, 0, 0, .4); }
			.namerow { position: relative; width: 100%; display: flex; justify-content: center; align-items: center; }
			.tools { position: absolute; right: 0; top: 50%; transform: translateY(-50%); display: flex; gap: 6px; }
			.blur { filter: blur(5px); }
			.side { position: absolute; top: 50%; transform: translateY(-50%); }
			.side.left { left: 0; } .side.right { right: 0; }
			.side button { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 8px; font-size: 12px; }
			.side img { width: 26px; height: 26px; }

			.main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: space-evenly; gap: 14px; margin-top: 8px; }
			.group { display: flex; flex-direction: column; gap: 4px; width: min(220px, 70%); }
			.group.narrow { width: min(150px, 55%); }
			.count { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; }
			.count img { width: 16px; height: 14px; object-fit: contain; }
			.wide { display: grid; grid-template-columns: 24px 1fr minmax(24px, auto); align-items: center; gap: 8px; padding: 9px 12px; font-size: 15px; font-weight: 600; }
			.label { text-align: center; }
			.extra { display: flex; gap: 6px; justify-content: flex-end; }

			.bottom { align-self: center; width: min(300px, 100%); display: flex; align-items: stretch; gap: 10px; padding-bottom: 6vh; }
			.small { display: flex; flex-direction: column; gap: 4px; width: 46%; }
			.shop { flex: 1; background: var(--button-shop-bg); color: var(--button-shop-text); display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 15px; }
			.shop:enabled:hover { background: var(--button-shop-bg); filter: brightness(.92); }
			.shop:enabled:active { background: var(--button-shop-bg); filter: brightness(.82); }
		</style>
		<div class="menu">
			<AppBar title="Бафия онлайн" right={<button class="back-link square" onClick={actions.telegram} aria-label="Telegram" style={{ background: "#fff", color: "#2aa3de", "border-radius": "50%", "border-color": "transparent" }}><Icon name="telegram" size={20} /></button>} />
			<div class="content">
				<div class="level">
					<div class="rank"><img src={images().rank} alt="" />{me().level}</div>
					<div class="bar">
						<div class="fill" style={{ width: progress() + "%" }}></div>
						<span>{formatNumber(me().experience) + " / " + formatNumber(me().next)}</span>
					</div>
				</div>

				<div class="corners">
					<span class="badge"><img src={images().trophy} width="15" alt="" />{formatNumber(me().rating)}</span>
					// <span class="badge"><Icon name="trophy" size={16} />{formatNumber(me().rating)}</span>
					<div class="coins">
						<span class="badge"><img src={images().sliver} width="16" height="14" alt="" />{formatNumber(me().silver)}</span>
						<span class="badge"><img src={images().gold} width="16" height="14" alt="" />{formatNumber(me().gold)}</span>
					</div>
				</div>

				<div class="hero">
					<div class="photo">
						<Avatar photo={() => me().photo} gif={myGif} ring={() => photoRing(me().decorations)} animation={() => animationOf(me().decorations, DecorationType.PhotoBorderAnimation)} assets={assets} size={120} />
						<button class="camera" onClick={actions.changePhoto} aria-label="Сменить фото"><Icon name="edit" size={16} /></button>
					</div>
					<div class="namerow">
						<div class="side left">
							<button onClick={actions.backpack}><img src={images().backpack} alt="" />{"Рюкзак"}</button>
						</div>
						<div class={hidden() ? "name blur" : "name"} data-keep style={{ position: "relative", isolation: "isolate", ...nickStyle(me().decorations) }}>
							@if (animationOf(me().decorations, DecorationType.UsernameAnimation)) {
								<Lottie animation={() => animationOf(me().decorations, DecorationType.UsernameAnimation)} inset="-15% -10%" />
							}
							{me().username}
						</div>
						<div class="tools">
							<button class="square" onClick={actions.settings} aria-label="Настройки"><img src={images().settings} alt="" /></button>
							<button class="square" onClick={actions.profile} aria-label="Профиль"><img src={images().profile} alt="" /></button>
						</div>
					</div>
				</div>

				<div class="main">
					<div class="group">
						<button class="wide" onClick={actions.rooms}><Icon name="rooms" /><span class="label">{"Комнаты"}</span><span></span></button>
						<button class="wide" onClick={actions.competitive}><Icon name="trophy" /><span class="label">{"Соревновательный"}</span><span></span></button>
					</div>
					<div class="group narrow">
						<button class="wide" onClick={actions.chat}><Icon name="chat" /><span class="label">{"Чат"}</span><span></span></button>
						<button class="wide" onClick={actions.friends}>
							<Icon name="person" /><span class="label">{"Друзья"}</span>
							<span class="extra">
								@if (me().messages > 0) {
									<span class="count">{me().messages}<img src={images().mail} alt="" /></span>
								}
								@if (me().requests > 0) {
									<span class="count">{me().requests}<img src={images().request} alt="" /></span>
								}
							</span>
						</button>
					</div>
				</div>

				<div class="version" data-keep>{version}</div>
				<div class="bottom">
					<div class="small">
						<button onClick={actions.ratings}>{"Рейтинги"}</button>
						<button onClick={actions.rules}>{"Правила"}</button>
						<button onClick={actions.history}>{"История игр"}</button>
					</div>
					<button class="shop" onClick={actions.shop}><Icon name="store" />{"Магазин"}</button>
				</div>
			</div>
		</div>
	</>
}
