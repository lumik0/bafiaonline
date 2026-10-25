import { createEffect, createSignal, fromEvents, onCleanup } from "@common/ui";
import { isMobile } from "@common/utils/mobile";
import type { ChatUser } from "../domain/chat/message";
import type { RoomSession } from "../domain/room/session";
import { sortRoles } from "../domain/rooms/room";
import { AppBar } from "../ui/AppBar.tsrx";
import { GameOverDialog } from "../ui/dialogs/GameOverDialog.tsrx";
import { RoomRolesDialog } from "../ui/dialogs/RoomRolesDialog.tsrx";
import { RoomSettingsDialog } from "../ui/dialogs/RoomSettingsDialog.tsrx";
import { Icon } from "../ui/Icon.tsrx";
import { roomInfoData } from "../mods/data";
import { ChatInput } from "../ui/ChatInput.tsrx";
import { ChatView, type ChatController } from "../ui/ChatView.tsrx";
import { PlayersPanel } from "../ui/PlayersPanel.tsrx";
import { GameInfo } from "../ui/room/GameInfo.tsrx";
import { KickVote } from "../ui/room/KickVote.tsrx";
import { PlayersGrid } from "../ui/room/PlayersGrid.tsrx";
import type { GameContext } from "../context";

const ROLE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** игровая комната: до игры - игроки и чат, в игре - стол с ролями, панель роли и таймер, чат */
export function RoomScreen({ ctx, session }: { ctx: GameContext, session: RoomSession }) @{
	const state = session.state;
	const controller: ChatController = {};
	let room!: HTMLDivElement;

	const view = fromEvents(session, "change", () => ({
		title: state.settings.title, playersLine: state.playersLine, loaded: state.loaded, inGame: state.inGame, night: state.inGame && state.isNight, info: state.info,
		roles: state.roleCounts ? Object.entries(state.roleCounts).map(([role, count]) => ({ role: Number(role), count })) : sortRoles(state.settings.roles).map(role => ({ role, count: 1 })),
		meAlive: state.me?.alive ?? true
	}));
	const entries = fromEvents(session, "change", () => state.messages.entries);
	const lobby = fromEvents(session, "change", (): ChatUser[] => state.lobby.map(player => ({ username: player.username, playerObjectId: player.playerObjectId, photo: player.photo, vip: player.vip })));
	const myName = fromEvents(ctx.user, "change", () => ctx.user.username);
	const hideName = fromEvents(ctx.settings, "change", () => ctx.settings.data.hideUsername);
	const layout = fromEvents(ctx.settings, "change", () => ({ width: ctx.settings.data.game.widthPL, zoom: ctx.settings.data.game.zoomPL }));
	const images = fromEvents(ctx.assets, "change", () => ({
		day: ctx.assets.url("textures/backgrounds/day3.png"),
		night: ctx.assets.url("textures/backgrounds/night3.png"),
		loading: ctx.assets.url("textures/loading/2f.png"),
		roles: Object.fromEntries(ROLE_IDS.map(id => [id, ctx.assets.url(`textures/roles/${id}.png`)])) as Record<number, string>
	}));
	const background = () => { const url = view().night ? images().night : images().day; return url ? "url(" + url + ")" : "none"; };

	// у ночных и дневных панелей разная прозрачность, как в старой версии
	const panel = () => view().night ? "rgb(255 255 255 / 30%)" : "";

	// шестерёнка в шапке есть, только если какой-то мод добавил настройки комнаты
	const [hasSettings, setHasSettings] = createSignal(false);
	const checkSettings = () => void ctx.mods.menuItems("roomSettings", roomInfoData(session)).then(items => setHasSettings(items.length > 0));
	checkSettings();
	const modsChange = ctx.mods.on("change", checkSettings);
	const showSettings = () => void ctx.dialogs.manager.open({ title: "НАСТРОЙКИ", render: close => RoomSettingsDialog({ ctx, session, close }) });
	// игра закончилась: окно с итогом (один раз; в просмотре сохранённой игры его нет)
	// сервер Бафии (если игрок согласился): кто из игроков комнаты играет в Бафии и сколько партий сыграно
	const bafiaOnline = fromEvents(ctx.bafia, "change", () => ctx.bafia.online);
	const bafiaPremium = fromEvents(ctx.bafia, "change", () => ctx.bafia.premiumOnline);
	createEffect(() => ctx.bafia.watch(lobby().map(user => ({ id: user.playerObjectId, nick: user.username }))));
	const over = session.on("over", () => { ctx.bafia.played(state.won); void ctx.dialogs.manager.open({ title: "ИГРА ОКОНЧЕНА", render: close => GameOverDialog({ ctx, session, close }) }); });

	const showRoles = () => void ctx.dialogs.manager.open({ title: "РОЛИ В КОМНАТЕ", render: close => RoomRolesDialog({ ctx, session, close }) });
	const mention = (username: string) => controller.mention?.(username);
	const sendMessage = (text: string) => { if(!ctx.mods.runCommand(text)) session.send(text); };
	const indexInChat = fromEvents(ctx.settings, "change", () => ctx.settings.data.game.showIndexPlChat);
	const nickPrefix = (username: string) => {
		if(!indexInChat() || !state.inGame) return undefined;
		const player = state.players.find(other => other.username == username);
		return player ? (player.index + 1) + " " : undefined;
	};
	const expand = (number: number) => (state.inGame ? state.players : state.lobby)[number - 1]?.username;

	const ended = session.on("ended", async reason => {
		if(reason == "kicked") await ctx.dialogs.alert("Тебя выгнали из комнаты", { title: "Выгнали" });
		else await ctx.dialogs.alert("В комнате уже есть игрок с твоим интернет-подключением.\nЗаходить с нескольких аккаунтов с одного подключения нельзя.", { title: "Нельзя играть" });
		ctx.nav.pop();
	});
	const notice = session.on("notice", text => ctx.host.notifications.show({ key: "room-notice", kind: "warning", title: "Комната", text }));
	const detachMods = ctx.mods.attachRoom(session);
	onCleanup(() => { ended.remove(); notice.remove(); over.remove(); modsChange.remove(); detachMods(); session.leave(); });

	let wasAlive = true;
	createEffect(() => {
		const alive = view().meAlive;
		if(wasAlive && !alive && ctx.settings.data.game.showYouDiedMessage) void ctx.dialogs.alert("Ты умер");
		wasAlive = alive;
	});

	// во время игры «назад» (кнопка, Esc, `) сначала спрашивает подтверждение
	ctx.backGuard = async () => {
		const playing = state.status == 3 && state.me?.alive;
		return true;//!playing || await ctx.dialogs.confirm("Игра идёт. Выйти из комнаты?", { yes: "Выйти" });
	};
	onCleanup(() => { ctx.backGuard = undefined; });
	const back = () => ctx.back();

	/** ширину списка игроков можно тянуть: размер запоминается */
	const startResize = (event: PointerEvent) => {
		// не даём браузеру начать выделение или перетаскивание картинки: оно прерывает жест
		event.preventDefault();
		const handle = event.currentTarget as HTMLElement;
		const startX = event.clientX, start = ctx.settings.data.game.widthPL;
		const move = (e: PointerEvent) => {
			// экранных пикселей в одной единице интерфейса: масштаб окна и страницы вместе
			const factor = room.offsetWidth ? room.getBoundingClientRect().width / room.offsetWidth : 1;
			ctx.settings.update(settings => { settings.game.widthPL = Math.round(Math.min(1600, Math.max(60, start - (e.clientX - startX) / factor))); });
		};
		handle.classList.add("active");
		// слушатели на window: жест работает, даже если курсор ушёл с ручки
		const stop = () => {
			handle.classList.remove("active");
			window.removeEventListener("pointermove", move, true);
			window.removeEventListener("pointerup", stop, true);
			window.removeEventListener("pointercancel", stop, true);
			window.removeEventListener("blur", stop);
		};
		window.addEventListener("pointermove", move, true);
		window.addEventListener("pointerup", stop, true);
		window.addEventListener("pointercancel", stop, true);
		window.addEventListener("blur", stop);
	};

	<>
		<style>
			.room { display: flex; flex-direction: column; height: 100%; background-size: cover; background-position: center; transition: background .8s; }
			.title { user-select: text; -webkit-user-select: text; }
			.loading { flex: 1; display: flex; align-items: center; justify-content: center; }
			.loading img { width: 64px; height: 64px; animation: rotate 1s steps(12) infinite; }
			.info { text-align: center; margin: 6px 0 0; font-size: 14px; color: var(--chat-name); }
			.body { flex: 1; min-height: 0; display: flex; }
			.left { flex: 1; min-width: 0; display: flex; flex-direction: column; }
			.chatbox { flex: 1; min-height: 0; }
			.table { position: relative; flex: none; max-width: calc(100% - 120px); display: flex; flex-direction: column; margin: 10px 4px 5px 10px; border-radius: 4px; outline: 2px solid rgba(190, 190, 190, .8); background: var(--chat-panel); }
			.table .scroll { flex: 1; min-height: 0; overflow-y: auto; border-radius: 4px; }
			.zoom { width: 100%; box-sizing: border-box; }
			/* ручка шириной 14px поверх левого края списка игроков: за тонкую полоску было трудно ухватиться */
			.splitter { position: absolute; left: -9px; top: 0; bottom: 0; width: 14px; z-index: 5; cursor: ew-resize; touch-action: none; }
			.splitter::after { content: ""; position: absolute; left: 6px; top: 0; bottom: 0; width: 2px; border-radius: 1px; background: transparent; transition: background .15s; }
			.splitter:hover::after, .splitter.active::after { background: var(--accent); }
			/* на телефоне места мало: панели чата и стола почти вплотную */
			.gear { padding: 6px; background: transparent; border: none; border-radius: 50%; display: flex; color: var(--header-text); }
			.phone .left { margin-right: -5px; }
			.phone .table { margin: 5px 4px 5px 0; }
			@keyframes rotate { to { transform: rotate(360deg); } }
		</style>
		<div class={isMobile() ? "room phone" : "room"} ref={room} style={{ "background-image": background(), "--chat-panel": panel() || undefined }}>
			<AppBar
				title={view().title}
				keepCase
				subtitle={view().playersLine}
				onBack={() => void back()}
				right={<><RoleIcons roles={view().roles} images={images().roles} onClick={showRoles} />{hasSettings() ? <button class="gear" onClick={showSettings} aria-label="Настройки комнаты"><Icon name="gear" size={24} /></button> : null}</>}
			/>
			@if (!view().loaded) {
				<div class="loading"><img src={images().loading} alt="" /></div>
			} @else if (!view().inGame) {
				<div class="body">
					<div class="left">
						<div class="info">{view().info}</div>
						<PlayersPanel users={lobby} myName={myName} hideName={hideName} assets={ctx.assets} mention={mention} profile={(id: string) => ctx.openProfile(id)} inBafia={(id: string) => bafiaOnline().has(id)} badgeColor={(id: string) => { bafiaPremium(); return ctx.bafia.premiumColor(id); }} />
						<div class="chatbox"><ChatView ctx={ctx} bafia={ctx.bafia} entries={entries} myName={myName} hideName={hideName} assets={ctx.assets} send={sendMessage} onAvatar={(id: string) => ctx.openProfile(id)} controller={controller} expand={expand} nickPrefix={nickPrefix} readonly={session.replay} externalInput={isMobile()} /></div>
					</div>
				</div>
			} @else {
				<div class="body">
					<div class="left">
						<GameInfo ctx={ctx} session={session} />
						<div class="chatbox"><ChatView ctx={ctx} bafia={ctx.bafia} entries={entries} myName={myName} hideName={hideName} assets={ctx.assets} send={sendMessage} onAvatar={(id: string) => ctx.openProfile(id)} controller={controller} expand={expand} nickPrefix={nickPrefix} readonly={session.replay} externalInput={isMobile()} extra={(entry) => entry.kickVote ? <KickVote session={session} entryId={entry.id} /> : null} /></div>
					</div>
					<div class="table" style={{ width: (isMobile() ? 115 : layout().width) + "px" }}>
						<div class="splitter" onPointerDown={startResize}></div>
						@if (!isMobile()) {
							<input class="zoom" type="range" min="25" max="50" value={layout().zoom * 25} onInput={(event) => ctx.settings.update(settings => { settings.game.zoomPL = Number(event.currentTarget.value) / 25; })} />
						}
						<div class="scroll" style={{ zoom: layout().zoom }}><PlayersGrid ctx={ctx} session={session} mention={mention} /></div>
					</div>
				</div>
			}
			@if (isMobile() && view().loaded && !session.replay) {
				<ChatInput ctx={ctx} bafia={ctx.bafia} assets={ctx.assets} send={sendMessage} expand={expand} controller={controller} />
			}
		</div>
	</>
}

/** роли комнаты в шапке; роли, которых в этой игре нет, бледнее */
function RoleIcons({ roles, images, onClick }: { roles: { role: number, count: number }[], images: Record<number, string>, onClick: () => void }) @{
	<>
		<style>
			.roles { display: grid; grid-template-columns: repeat(5, 25px); gap: 2px; align-items: center; cursor: pointer; }
			.roles img { width: 25px; height: 35px; object-fit: contain; }
			.roles img.none { opacity: .5; }
		</style>
		<div class="roles" onClick={onClick}>
			@for (const item of roles) {
				<img class={item.count == 0 ? "none" : ""} src={images[item.role]} alt="" />
			}
		</div>
	</>
}
