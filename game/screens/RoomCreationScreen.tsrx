import { createEffect, fromEvents } from "@common/ui";
import { createSignal } from "@common/ui";
import { openRoom } from "../domain/rooms/enter";
import { rememberRoomPassword } from "../domain/rooms/passwords";
import { md5salt } from "@common/utils/md5";
import { joinProblems } from "../domain/rooms/rooms";
import { AppBar } from "../ui/AppBar.tsrx";
import { bafiaRoomProblems, openBafiaRoom } from "../domain/rooms/bafia-open";
import type { GameContext } from "../context";

/** готовые наборы правил комнат Бафии */
const PRESETS = [
	{ id: "classic", name: "Классика", hint: "как в игре" },
	{ id: "terrorists", name: "Террористы везде", hint: "много террористов, они общаются ночью" },
	{ id: "shuffle", name: "Роли каждую ночь", hint: "каждую ночь все меняются ролями, и мафия тоже" },
	{ id: "epidemic", name: "Эпидемия", hint: "мафия заражает вместо убийства, заражённые потом становятся мафией" },
	{ id: "royale", name: "Королевская битва", hint: "мафии нет, она появляется по ночам и убивает по одному (от 10 игроков)" },
	{ id: "chaos", name: "Хаос", hint: "каждый день случайный прикол из подходящих" }
];

const MAFIA = [{ id: 6, name: "Террорист" }, { id: 9, name: "Бармен" }, { id: 11, name: "Информатор" }];
const TIMERS = [
	{ key: "registration" as const, name: "Сбор", min: 15, max: 150 }, { key: "lover" as const, name: "Ночь", min: 10, max: 150 }, { key: "night" as const, name: "Ночное голосование", min: 15, max: 150 },
	{ key: "day" as const, name: "День", min: 15, max: 150 }, { key: "vote" as const, name: "Голосование", min: 10, max: 150 }
];
/** как в официальной игре: эти роли бывают только за столом от 12 игроков */
const LATE = [6, 7, 8];
const TEAM = [{ id: 4, name: "Мафия" }, ...MAFIA];
const PEACEFUL = [{ id: 2, name: "Доктор" }, { id: 3, name: "Шериф" }, { id: 5, name: "Любовница" }, { id: 7, name: "Журналист" }, { id: 8, name: "Телохранитель" }, { id: 10, name: "Шпион" }];

/** создание комнаты. Выбранное запоминается и подставляется в следующий раз (как в старой версии) */
export function RoomCreationScreen({ ctx, bafia = false }: { ctx: GameContext, bafia?: boolean }) @{
	// комната Бафии: те же поля, но свои значения (не трогают настройки официальной), игроков до 50, вместо VIP - только для премиума
	// настройки комнаты Бафии запоминаются: в следующий раз экран открывается с тем, что было выбрано
	const stored = ctx.settings.data.bafiaRoom;
	const load = <T,>(key: string, fallback: T): T => {
		const value = stored[key];
		return value !== null && value !== undefined && typeof value == typeof fallback && Array.isArray(value) == Array.isArray(fallback) ? value as T : fallback;
	};
	const [own, setOwn] = createSignal(load("own", { title: "", dayTime: 0, minPlayers: 12, maxPlayers: 16, minLevel: 1, selectedRoles: [6, 9, 11, 2, 5, 7, 8, 10], password: "", vip: false }));
	// роли с числом (+/-): сколько игроков каждой роли; общий предел зависит от минимума игроков
	const [counts, setCounts] = createSignal<Record<number, number>>(load("counts", { 9: 1, 11: 1, 2: 1, 3: 1, 5: 1, 7: 1, 10: 1 }));
	const [timers, setTimers] = createSignal(Object.fromEntries(Object.entries(load("timers", { registration: 60, lover: 20, night: 40, day: 60, vote: 40 })).map(([key, value]) => [key, Math.min(150, value as number)])) as { registration: number, lover: number, night: number, day: number, vote: number });
	const [calmFirstNight, setCalmFirstNight] = createSignal(load("calmFirstNight", false));
	const [hideRoles, setHideRoles] = createSignal(load("hideRoles", false));
	const [noLastWord, setNoLastWord] = createSignal(load("noLastWord", false));
	const [blindVote, setBlindVote] = createSignal(load("blindVote", false));
	const [bloodbath, setBloodbath] = createSignal(load("bloodbath", false));
	const [killable, setKillable] = createSignal<number[]>(load("killable", [4, 6, 9, 11]));
	const [blindMafia, setBlindMafia] = createSignal(load("blindMafia", false));
	const KINDS = [{ id: 1, name: "Овощ" }, ...PEACEFUL];
	const ALL_KINDS = KINDS.map(role => role.id);
	const [peacefulKnow, setPeacefulKnow] = createSignal(load("peacefulKnow", false));
	const [peacefulMatrix, setPeacefulMatrix] = createSignal<Record<number, number[]>>(load("peacefulMatrix", Object.fromEntries(ALL_KINDS.map(id => [id, []]))));
	const [peacefulChat, setPeacefulChat] = createSignal(load("peacefulChat", false));
	const [chatRoles, setChatRoles] = createSignal<number[]>(load("chatRoles", ALL_KINDS));
	const [openKnow, setOpenKnow] = createSignal(load("openKnow", false));
	const [know, setKnow] = createSignal<Record<number, number[]>>(load("know", { 4: [4, 6], 6: [], 9: [], 11: [] }));
	const [preset, setPreset] = createSignal(load("preset", "classic"));
	const [voteChat, setVoteChat] = createSignal(load("voteChat", false));
	const [selfProtect, setSelfProtect] = createSignal(load("selfProtect", false));
	if(bafia) createEffect(() => {
		const snapshot = { own: own(), counts: counts(), blindVote: blindVote(), bloodbath: bloodbath(), killable: killable(), blindMafia: blindMafia(), peacefulKnow: peacefulKnow(), peacefulMatrix: peacefulMatrix(), peacefulChat: peacefulChat(), chatRoles: chatRoles(), openKnow: openKnow(), know: know(), preset: preset(), voteChat: voteChat(), selfProtect: selfProtect(), timers: timers(), calmFirstNight: calmFirstNight(), hideRoles: hideRoles(), noLastWord: noLastWord() };
		ctx.settings.update(settings => { settings.bafiaRoom = JSON.parse(JSON.stringify(snapshot)); });
	});
	const official = fromEvents(ctx.settings, "change", () => ({ ...ctx.settings.data.roomCreate, selectedRoles: [...ctx.settings.data.roomCreate.selectedRoles] }));
	const draft = () => bafia ? own() : official();
	const limit = bafia ? 50 : 21;
	const images = fromEvents(ctx.assets, "change", () => ({
		roles: Object.fromEntries([...MAFIA, ...PEACEFUL].map(role => [role.id, ctx.assets.url(`textures/roles/${role.id}.png`)])) as Record<number, string>,
		vip: ctx.assets.url("textures/vip/_u.png")
	}));
	const [pending, setPending] = createSignal(false);

	/** сколько дополнительных ролей можно взять при таком минимуме игроков: мафия (четверть) и хотя бы один мирный всегда есть, мафия остаётся меньше остальных */
	const roomMafia = () => Math.max(1, Math.floor(own().minPlayers / 4));
	const roleCap = () => Math.max(0, own().minPlayers - 1 - roomMafia());
	const mafiaCap = () => Math.max(0, Math.ceil(own().minPlayers / 2) - 1 - roomMafia());
	// в эпидемии мафия заражает, а в королевской битве её нет: роли команды мафии там не нужны
	const noMafiaRoles = () => preset() == "epidemic" || preset() == "royale";
	const roleTotal = (list: Record<number, number> = counts()) => Object.entries(list).reduce((sum, [id, value]) => sum + ((noMafiaRoles() && MAFIA.some(role => role.id == Number(id))) || locked(Number(id)) ? 0 : value), 0);
	const mafiaTotal = (list: Record<number, number> = counts()) => MAFIA.reduce((sum, role) => sum + (list[role.id] ?? 0), 0);
	const locked = (id: number) => LATE.includes(id) && own().maxPlayers < 12;
	const canAdd = (id: number) => !locked(id) && roleTotal() < roleCap() && (!MAFIA.some(role => role.id == id) || mafiaTotal() < mafiaCap());
	const step = (id: number, delta: number) => {
		if(delta > 0 ? !canAdd(id) : !(counts()[id] > 0)) return;
		setCounts({ ...counts(), [id]: (counts()[id] ?? 0) + delta });
	};
	/** минимум игроков уменьшили: роли сверх нового предела убираем с конца */
	const fitCounts = () => {
		const next = { ...counts() };
		for(const role of [...PEACEFUL, ...MAFIA].reverse()) while((next[role.id] ?? 0) > 0 && (roleTotal(next) > roleCap() || mafiaTotal(next) > mafiaCap())) next[role.id]!--;
		setCounts(next);
	};
	const toggle = <T,>(list: T[], item: T) => list.includes(item) ? list.filter(other => other != item) : [...list, item];
	const edit = (change: (data: typeof ctx.settings.data.roomCreate) => void) => {
		if(!bafia) return ctx.settings.update(settings => change(settings.roomCreate));
		const next = { ...own(), selectedRoles: [...own().selectedRoles] };
		change(next);
		setOwn(next);
	};
	const toggleRole = (id: number) => edit(data => { data.selectedRoles = data.selectedRoles.includes(id) ? data.selectedRoles.filter(role => role != id) : [...data.selectedRoles, id]; });
	/** минимум не может быть больше максимума: двигаем второй ползунок вслед за первым */
	const setMin = (value: number) => { edit(data => { data.minPlayers = value; if(data.maxPlayers < value) data.maxPlayers = value; }); if(bafia) fitCounts(); };
	const setMax = (value: number) => { edit(data => { data.maxPlayers = value; if(data.minPlayers > value) data.minPlayers = value; }); if(bafia) fitCounts(); };

	const create = async () => {
		if(pending()) return;
		setPending(true);
		try {
			const data = bafia ? own() : ctx.settings.data.roomCreate;
			if(bafia) {
				const made = await ctx.bafia.createRoom({
					title: data.title.trim(), minPlayers: data.minPlayers, maxPlayers: data.maxPlayers, preset: preset(), voteChat: voteChat(), selfProtect: selfProtect(),
					timers: timers(), calmFirstNight: calmFirstNight(), hideRoles: hideRoles(), noLastWord: noLastWord(), extraCounts: Object.fromEntries(Object.entries(counts()).filter(([id]) => (!noMafiaRoles() || !MAFIA.some(role => role.id == Number(id))) && !locked(Number(id)))), modifiers: blindVote() ? ["blindVote"] : [], ...(bloodbath() ? { killable: killable() } : {}), knowledge: { ...(blindMafia() ? { 4: [], 6: [], 9: [], 11: [] } : openKnow() ? know() : {}), ...(peacefulKnow() ? peacefulMatrix() : {}) }, ...(blindMafia() ? { circles: [] } : {}), peacefulChat: peacefulChat() ? chatRoles() : [], password: data.password, premiumOnly: data.vip
				});
				if("error" in made) await ctx.dialogs.alert(bafiaRoomProblems[made.error] ?? "Не получилось создать комнату.");
				else { ctx.nav.pop(); openBafiaRoom(ctx, made.adapter); }
				setPending(false);
				return;
			}
			const result = await ctx.rooms.create({
				title: data.title, minPlayers: data.minPlayers, maxPlayers: data.maxPlayers, minLevel: data.minLevel,
				selectedRoles: data.selectedRoles, password: data.password, vip: data.vip
			});
			if(result.status == "ok") {
				// вышел и вернулся в свою комнату с паролем: заново вводить его не нужно
				if(data.password && result.roomId) rememberRoomPassword(ctx.settings, result.roomId, md5salt(data.password));
				openRoom(ctx, result, { replace: true });
			}
			else await ctx.dialogs.alert(joinProblems[result.status]);
		} catch {
			await ctx.dialogs.alert("Сервер не ответил. Попробуй ещё раз", { title: "Ошибка" });
		}
		setPending(false);
	};

	/** короткая сводка для нижней панели: что получится */
	const summary = () => {
		const data = draft();
		const players = data.minPlayers == data.maxPlayers ? String(data.maxPlayers) : data.minPlayers + "-" + data.maxPlayers;
		return `Игроков ${players}` + (bafia ? "" : ` · уровень ${data.minLevel}+`) + (bafia ? (roleTotal() ? ` · ролей +${roleTotal()}` : "") : data.selectedRoles.length ? ` · ролей +${data.selectedRoles.length}` : "") + (data.vip ? (bafia ? " · премиум" : " · VIP") : "") + (data.password ? " · с паролем" : "");
	};

	<>
		<style>
			.page { display: flex; flex-direction: column; height: 100%; }
			.form { flex: 1; overflow-y: auto; padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 10px; }
			.card { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border-radius: 15px; background: var(--surface); color: var(--text-dark); }
			.card h4 { margin: 0; font-size: 15px; font-weight: 600; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
			.card h4 small { font-size: 12px; font-weight: 400; opacity: .65; }
			.field { display: flex; flex-direction: column; gap: 4px; }
			.field label { font-size: 12px; opacity: .7; }
			input[type=text], input[type=password] { width: 100%; box-sizing: border-box; padding: 10px 12px; font-size: 15px; border-radius: 10px; }
			select { width: 100%; box-sizing: border-box; padding: 10px 36px 10px 12px; font-size: 15px; border-radius: 10px; color: inherit; cursor: pointer; appearance: none; -webkit-appearance: none; background-color: rgba(128, 128, 128, .18); background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%); background-position: calc(100% - 20px) 50%, calc(100% - 14px) 50%; background-size: 6px 6px, 6px 6px; background-repeat: no-repeat; border: 2px solid transparent; }
			select:focus { outline: none; border-color: var(--accent); }
			select option { color: #222; background: #fff; }
			.slider { display: grid; grid-template-columns: 130px 1fr 38px; align-items: center; gap: 10px; font-size: 13px; }
			.slider input { accent-color: var(--accent); margin: 0; }
			.slider output { min-width: 28px; padding: 2px 0; text-align: center; border-radius: 8px; background: rgba(128, 128, 128, .2); font-weight: 700; }
			.switch { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 15px; cursor: pointer; }
			.switch .name { display: flex; align-items: center; gap: 8px; }
			.switch img { width: 25px; height: 35px; object-fit: contain; }
			.switch input { appearance: none; -webkit-appearance: none; flex: none; width: 46px; height: 26px; margin: 0; border-radius: 13px; background: rgba(128, 128, 128, .45); position: relative; cursor: pointer; transition: background .15s; }
			.switch input::after { content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .3); transition: transform .15s; }
			.switch input:checked { background: var(--accent); }
			.switch input:checked::after { transform: translateX(20px); }
			.team { font-size: 12px; font-weight: 600; letter-spacing: .02em; padding: 2px 8px; border-radius: 8px; align-self: flex-start; }
			.team.mafia { background: rgba(229, 72, 77, .18); color: #b3262b; }
			.team.peaceful { background: rgba(48, 164, 108, .2); color: #1d7a4a; }
			.roles { display: grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr)); gap: 8px; }
			.role { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px 6px; border-radius: 12px; border: 2px solid transparent; background: rgba(128, 128, 128, .14); color: inherit; font-size: 12px; line-height: 1.2; text-align: center; cursor: pointer; transition: background .12s, border-color .12s, transform .12s; }
			/* общий стиль кнопок темы красит наведение и нажатие красным: у плитки ролей свои состояния */
			.role:enabled:hover, .role:enabled:active { background: rgba(128, 128, 128, .26) !important; }
			.role.on:enabled:hover, .role.on:enabled:active { background: rgba(128, 128, 128, .3) !important; }
			.role img { width: 38px; height: 52px; object-fit: contain; opacity: .55; filter: grayscale(.6); transition: opacity .12s, filter .12s; }
			.role.on { border-color: var(--accent); background: rgba(128, 128, 128, .22); }
			.role.on img { opacity: 1; filter: none; }
			.role.on::after { content: "✓"; position: absolute; top: 4px; right: 6px; font-size: 12px; font-weight: 700; color: var(--accent); }
			.chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
			.chip { padding: 4px 10px; font-size: 12px; border-radius: 12px; border: 2px solid transparent; background: rgba(128, 128, 128, .14); color: inherit; }
			.chip.on { border-color: var(--accent); }
			.counter { display: flex; align-items: center; gap: 6px; font-size: 13px; }
			.counter button { padding: 2px 10px; font-size: 16px; border-radius: 8px; }
			.counter b { min-width: 16px; text-align: center; }
			.bar { flex: none; display: flex; align-items: center; gap: 10px; padding: 8px 12px calc(8px + env(safe-area-inset-bottom)); background: var(--header-bg); color: var(--header-text); }
			.bar .summary { flex: 1; min-width: 0; font-size: 12px; opacity: .9; line-height: 1.3; }
			.bar button { flex: none; padding: 10px 22px; font-size: 15px; font-weight: 700; border-radius: 12px; }
		</style>
		<div class="page">
			<AppBar title={bafia ? "Комната Бафии" : "Создание комнаты"} onBack={() => ctx.nav.pop()} />
			<div class="form">
				<div class="card">
					<div class="field">
						<label>{"Название"}</label>
						<input type="text" placeholder="Например, eriised крутая" maxlength="30" value={draft().title} onInput={(event) => edit(data => { data.title = event.currentTarget.value; })} />
					</div>
					<div class="field">
						<label>{"Пароль (можно не ставить)"}</label>
						<input type="password" placeholder="Без пароля" value={draft().password} onInput={(event) => edit(data => { data.password = event.currentTarget.value; })} />
					</div>
					<label class="switch"><span class="name">{bafia ? null : <img src={images().vip} alt="" />}{bafia ? "Только для премиума" : "VIP-комната"}</span><input type="checkbox" checked={draft().vip} onChange={(event) => edit(data => { data.vip = event.currentTarget.checked; })} /></label>
				</div>

				<div class="card">
					<h4>{"Игроки"}<small>{draft().minPlayers == draft().maxPlayers ? draft().maxPlayers : draft().minPlayers + " - " + draft().maxPlayers}</small></h4>
					<div class="slider"><span>{"мин."}</span><input type="range" min={bafia ? 4 : 1} max={limit} value={draft().minPlayers} onInput={(event) => setMin(Number(event.currentTarget.value))} /><output>{draft().minPlayers}</output></div>
					<div class="slider"><span>{"макс."}</span><input type="range" min={bafia ? 4 : 1} max={limit} value={draft().maxPlayers} onInput={(event) => setMax(Number(event.currentTarget.value))} /><output>{draft().maxPlayers}</output></div>
				</div>

				@if (bafia) {
					<div class="card">
						<h4>{"Правила"}<small>{PRESETS.find(item => item.id == preset())?.name}</small></h4>
						<select value={preset()} onChange={(event) => setPreset(event.currentTarget.value)}>
							@for (const item of PRESETS) {
								<option value={item.id} selected={item.id == preset()}>{item.name}</option>
							}
						</select>
						<small>{PRESETS.find(item => item.id == preset())?.hint}</small>
						<label class="switch"><span class="name">{"Слепое голосование"}</span><input type="checkbox" checked={blindVote()} onChange={(event) => setBlindVote(event.currentTarget.checked)} /></label>
						<small>{"кто за кого - тайна, после дня объявляют число голосов"}</small>
						<label class="switch"><span class="name">{"Кровавая мафия"}</span><input type="checkbox" checked={bloodbath()} onChange={(event) => setBloodbath(event.currentTarget.checked)} /></label>
						@if (bloodbath()) {
							<div class="chips">
								<small>{"Кого мафия может убить кроме мирных:"}</small>
								@for (const role of TEAM) {
									<button class={killable().includes(role.id) ? "chip on" : "chip"} onClick={() => setKillable(toggle(killable(), role.id))}>{role.name}</button>
								}
							</div>
						}
						<label class="switch"><span class="name">{"Слепая мафия"}</span><input type="checkbox" checked={blindMafia()} onChange={(event) => { setBlindMafia(event.currentTarget.checked); if(event.currentTarget.checked) { setOpenKnow(false); } }} /></label>
						<small>{"мафия не знает никого и ночью не общается"}</small>
						@if (!blindMafia()) {
						<>
						<label class="switch"><span class="name">{"Все мафы знают всех"}</span><input type="checkbox" checked={openKnow()} onChange={(event) => setOpenKnow(event.currentTarget.checked)} /></label>
						@if (openKnow()) {
							@for (const who of TEAM) {
								<div class="chips">
									<small>{who.name + " знает:"}</small>
									@for (const other of TEAM) {
										<button class={(know()[who.id] ?? []).includes(other.id) ? "chip on" : "chip"} onClick={() => setKnow({ ...know(), [who.id]: toggle(know()[who.id] ?? [], other.id) })}>{other.name}</button>
									}
								</div>
							}
						}
						</>
						}
						<label class="switch"><span class="name">{"Все миры знают всех"}</span><input type="checkbox" checked={peacefulKnow()} onChange={(event) => setPeacefulKnow(event.currentTarget.checked)} /></label>
						@if (peacefulKnow()) {
							@for (const who of KINDS) {
								<div class="chips">
									<small>{who.name + " знает:"}</small>
									@for (const other of KINDS) {
										<button class={(peacefulMatrix()[who.id] ?? []).includes(other.id) ? "chip on" : "chip"} onClick={() => setPeacefulMatrix({ ...peacefulMatrix(), [who.id]: toggle(peacefulMatrix()[who.id] ?? [], other.id) })}>{other.name}</button>
									}
								</div>
							}
						}
						<label class="switch"><span class="name">{"Миры могут писать ночью в чат"}</span><input type="checkbox" checked={peacefulChat()} onChange={(event) => setPeacefulChat(event.currentTarget.checked)} /></label>
						@if (peacefulChat()) {
							<div class="chips">
								<small>{"Кто пишет в общий ночной чат:"}</small>
								@for (const role of KINDS) {
									<button class={chatRoles().includes(role.id) ? "chip on" : "chip"} onClick={() => setChatRoles(toggle(chatRoles(), role.id))}>{role.name}</button>
								}
							</div>
						}
						<label class="switch"><span class="name">{"Первая ночь мирная"}</span><input type="checkbox" checked={calmFirstNight()} onChange={(event) => setCalmFirstNight(event.currentTarget.checked)} /></label>
						<small>{"мафия общается, но никого не убивает"}</small>
						<label class="switch"><span class="name">{"Роль убитого скрыта"}</span><input type="checkbox" checked={hideRoles()} onChange={(event) => setHideRoles(event.currentTarget.checked)} /></label>
						<label class="switch"><span class="name">{"Без последнего слова"}</span><input type="checkbox" checked={noLastWord()} onChange={(event) => setNoLastWord(event.currentTarget.checked)} /></label>
						<label class="switch"><span class="name">{"Писать в чат во время голосования"}</span><input type="checkbox" checked={voteChat()} onChange={(event) => setVoteChat(event.currentTarget.checked)} /></label>
						<label class="switch"><span class="name">{"Доктор и телохранитель могут защитить себя"}</span><input type="checkbox" checked={selfProtect()} onChange={(event) => setSelfProtect(event.currentTarget.checked)} /></label>
					</div>
				} @else {
				<div class="card">
					<h4>{"Уровень комнаты"}<small>{"кто может зайти"}</small></h4>
					<div class="slider"><span>{"от"}</span><input type="range" min="1" max="13" value={draft().minLevel} onInput={(event) => edit(data => { data.minLevel = Number(event.currentTarget.value); })} /><output>{draft().minLevel}</output></div>
				</div>
				}

				@if (bafia) {
					<>
					<div class="card">
						<h4>{"Время"}<small>{"секунд"}</small></h4>
						@for (const item of TIMERS) {
							<div class="slider"><span>{item.name}</span><input type="range" min={item.min} max={item.max} step="5" value={timers()[item.key]} onInput={(event) => setTimers({ ...timers(), [item.key]: Number(event.currentTarget.value) })} /><output>{timers()[item.key]}</output></div>
						}
					</div>
					<div class="card">
						<h4>{"Дополнительные роли"}<small>{roleTotal() + " из " + roleCap()}</small></h4>
						<small>{"Предел зависит от минимума игроков: " + draft().minPlayers + ". Мафия и мирные есть всегда."}</small>
						@if (!noMafiaRoles()) {
							<>
								<span class="team mafia">{"Команда мафии"}<small>{" · " + mafiaTotal() + " из " + mafiaCap()}</small></span>
								<div class="roles">
									@for (const role of MAFIA) {
										<div class={(counts()[role.id] ?? 0) > 0 ? "role on" : "role"}><img src={images().roles[role.id]} alt="" />{role.name}{locked(role.id) ? <small>{"от 12 игроков"}</small> : null}<span class="counter"><button disabled={!(counts()[role.id] > 0)} onClick={() => step(role.id, -1)}>{"−"}</button><b>{counts()[role.id] ?? 0}</b><button disabled={!canAdd(role.id)} onClick={() => step(role.id, 1)}>{"+"}</button></span></div>
									}
								</div>
							</>
						}
						<span class="team peaceful">{"Команда мирных жителей"}</span>
						<div class="roles">
							@for (const role of PEACEFUL) {
								<div class={(counts()[role.id] ?? 0) > 0 ? "role on" : "role"}><img src={images().roles[role.id]} alt="" />{role.name}{locked(role.id) ? <small>{"от 12 игроков"}</small> : null}<span class="counter"><button disabled={!(counts()[role.id] > 0)} onClick={() => step(role.id, -1)}>{"−"}</button><b>{counts()[role.id] ?? 0}</b><button disabled={!canAdd(role.id)} onClick={() => step(role.id, 1)}>{"+"}</button></span></div>
							}
						</div>
					</div>
					</>
				} @else {
				<div class="card">
					<h4>{"Дополнительные роли"}<small>{draft().selectedRoles.length ? "выбрано " + draft().selectedRoles.length : "не выбраны"}</small></h4>
					<span class="team mafia">{"Команда мафии"}</span>
					<div class="roles">
						@for (const role of MAFIA) {
							<button class={draft().selectedRoles.includes(role.id) ? "role on" : "role"} aria-pressed={draft().selectedRoles.includes(role.id)} onClick={() => toggleRole(role.id)}><img src={images().roles[role.id]} alt="" />{role.name}</button>
						}
					</div>
					<span class="team peaceful">{"Команда мирных жителей"}</span>
					<div class="roles">
						@for (const role of PEACEFUL) {
							<button class={draft().selectedRoles.includes(role.id) ? "role on" : "role"} aria-pressed={draft().selectedRoles.includes(role.id)} onClick={() => toggleRole(role.id)}><img src={images().roles[role.id]} alt="" />{role.name}</button>
						}
					</div>
				</div>
				}
			</div>
			<div class="bar">
				<span class="summary">{summary()}</span>
				<button class="create" disabled={pending()} onClick={create}>{pending() ? "Создаём…" : "Создать"}</button>
			</div>
		</div>
	</>
}
