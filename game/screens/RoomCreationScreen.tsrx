import { fromEvents } from "@common/ui";
import { createSignal } from "@common/ui";
import { openRoom } from "../domain/rooms/enter";
import { joinProblems } from "../domain/rooms/rooms";
import { AppBar } from "../ui/AppBar.tsrx";
import type { GameContext } from "../context";

const MAFIA = [{ id: 6, name: "Террорист" }, { id: 9, name: "Бармен" }, { id: 11, name: "Информатор" }];
const PEACEFUL = [{ id: 2, name: "Доктор" }, { id: 5, name: "Любовница" }, { id: 7, name: "Журналист" }, { id: 8, name: "Телохранитель" }, { id: 10, name: "Шпион" }];

/** создание комнаты. Выбранное запоминается и подставляется в следующий раз (как в старой версии) */
export function RoomCreationScreen({ ctx }: { ctx: GameContext }) @{
	const draft = fromEvents(ctx.settings, "change", () => ({ ...ctx.settings.data.roomCreate, selectedRoles: [...ctx.settings.data.roomCreate.selectedRoles] }));
	const images = fromEvents(ctx.assets, "change", () => ({
		roles: Object.fromEntries([...MAFIA, ...PEACEFUL].map(role => [role.id, ctx.assets.url(`textures/roles/${role.id}.png`)])) as Record<number, string>,
		vip: ctx.assets.url("textures/vip/_u.png")
	}));
	const [pending, setPending] = createSignal(false);

	const edit = (change: (data: typeof ctx.settings.data.roomCreate) => void) => ctx.settings.update(settings => change(settings.roomCreate));
	const toggleRole = (id: number) => edit(data => { data.selectedRoles = data.selectedRoles.includes(id) ? data.selectedRoles.filter(role => role != id) : [...data.selectedRoles, id]; });
	/** минимум не может быть больше максимума: двигаем второй ползунок вслед за первым */
	const setMin = (value: number) => edit(data => { data.minPlayers = value; if(data.maxPlayers < value) data.maxPlayers = value; });
	const setMax = (value: number) => edit(data => { data.maxPlayers = value; if(data.minPlayers > value) data.minPlayers = value; });

	const create = async () => {
		if(pending()) return;
		setPending(true);
		try {
			const data = ctx.settings.data.roomCreate;
			const result = await ctx.rooms.create({
				title: data.title, minPlayers: data.minPlayers, maxPlayers: data.maxPlayers, minLevel: data.minLevel,
				selectedRoles: data.selectedRoles, password: data.password, vip: data.vip
			});
			if(result.status == "ok") openRoom(ctx, result, { replace: true });
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
		return `Игроков ${players} · уровень ${data.minLevel}+` + (data.selectedRoles.length ? ` · ролей +${data.selectedRoles.length}` : "") + (data.vip ? " · VIP" : "") + (data.password ? " · с паролем" : "");
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
			.slider { display: grid; grid-template-columns: 42px 1fr 34px; align-items: center; gap: 10px; font-size: 13px; }
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
			.bar { flex: none; display: flex; align-items: center; gap: 10px; padding: 8px 12px calc(8px + env(safe-area-inset-bottom)); background: var(--header-bg); color: var(--header-text); }
			.bar .summary { flex: 1; min-width: 0; font-size: 12px; opacity: .9; line-height: 1.3; }
			.bar button { flex: none; padding: 10px 22px; font-size: 15px; font-weight: 700; border-radius: 12px; }
		</style>
		<div class="page">
			<AppBar title="Создание комнаты" onBack={() => ctx.nav.pop()} />
			<div class="form">
				<div class="card">
					<div class="field">
						<label>{"Название"}</label>
						<input type="text" placeholder="Например, Новички, заходите" maxlength="30" value={draft().title} onInput={(event) => edit(data => { data.title = event.currentTarget.value; })} />
					</div>
					<div class="field">
						<label>{"Пароль (можно не ставить)"}</label>
						<input type="password" placeholder="Без пароля" value={draft().password} onInput={(event) => edit(data => { data.password = event.currentTarget.value; })} />
					</div>
					<label class="switch"><span class="name"><img src={images().vip} alt="" />{"VIP-комната"}</span><input type="checkbox" checked={draft().vip} onChange={(event) => edit(data => { data.vip = event.currentTarget.checked; })} /></label>
				</div>

				<div class="card">
					<h4>{"Игроки"}<small>{draft().minPlayers == draft().maxPlayers ? draft().maxPlayers : draft().minPlayers + " - " + draft().maxPlayers}</small></h4>
					<div class="slider"><span>{"мин."}</span><input type="range" min="1" max="21" value={draft().minPlayers} onInput={(event) => setMin(Number(event.currentTarget.value))} /><output>{draft().minPlayers}</output></div>
					<div class="slider"><span>{"макс."}</span><input type="range" min="1" max="21" value={draft().maxPlayers} onInput={(event) => setMax(Number(event.currentTarget.value))} /><output>{draft().maxPlayers}</output></div>
				</div>

				<div class="card">
					<h4>{"Уровень комнаты"}<small>{"кто может зайти"}</small></h4>
					<div class="slider"><span>{"от"}</span><input type="range" min="1" max="13" value={draft().minLevel} onInput={(event) => edit(data => { data.minLevel = Number(event.currentTarget.value); })} /><output>{draft().minLevel}</output></div>
				</div>

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
			</div>
			<div class="bar">
				<span class="summary">{summary()}</span>
				<button class="create" disabled={pending()} onClick={create}>{pending() ? "Создаём…" : "Создать"}</button>
			</div>
		</div>
	</>
}
