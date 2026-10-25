import { fromEvents } from "@common/ui";
import { defaultFilter, type RoomFilter } from "../../domain/rooms/filter";
import type { GameContext } from "../../context";

const MAFIA = [{ id: 6, name: "Террорист" }, { id: 9, name: "Бармен" }, { id: 11, name: "Информатор" }];
const PEACEFUL = [{ id: 2, name: "Доктор" }, { id: 5, name: "Любовница" }, { id: 7, name: "Журналист" }, { id: 8, name: "Телохранитель" }, { id: 10, name: "Шпион" }];
type Flag = "friends" | "vip" | "withoutVip" | "withPassword" | "withoutPassword" | "isRegistration" | "isStarted" | "noRoles";
type Count = "minPl" | "maxPl" | "minLvl" | "maxLvl";

const FLAGS: { key: Flag, label: string }[] = [
	{ key: "friends", label: "Есть друзья в комнате" }, { key: "vip", label: "Только VIP-комнаты" }, { key: "withoutVip", label: "Без VIP-комнат" },
	{ key: "withoutPassword", label: "Комнаты без пароля" }, { key: "withPassword", label: "Комнаты с паролем" }
];
const COUNTS: { key: Count, label: string }[] = [
	{ key: "minPl", label: "Мин. игроков" }, { key: "maxPl", label: "Макс. игроков" }, { key: "minLvl", label: "Мин. уровень" }, { key: "maxLvl", label: "Макс. уровень" }
];

/** фильтр списка комнат. Любое изменение включает фильтр, как в старой версии */
export function RoomFilterDialog({ ctx, close }: { ctx: GameContext, close: () => void }) @{
	const store = ctx.roomFilter;
	const filter = fromEvents(store, "change", (): RoomFilter => ({ ...store.data, roles: [...store.data.roles] }));
	const roleImages = fromEvents(ctx.assets, "change", () => Object.fromEntries([...MAFIA, ...PEACEFUL].map(role => [role.id, ctx.assets.url(`textures/roles/${role.id}.png`)])) as Record<number, string>);

	const change = (apply: (data: RoomFilter) => void) => store.update(data => { apply(data); data.enabled = true; });
	const toggleRole = (id: number) => change(data => { data.roles = data.roles.includes(id) ? data.roles.filter(role => role != id) : [...data.roles, id]; });

	<>
		<style>
			.dialog { display: flex; flex-direction: column; gap: 6px; max-height: 420px; overflow-y: auto; font-size: 14px; }
			.row { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 30px; }
			.row input[type=checkbox] { zoom: 1.4; }
			.row input[type=number] { width: 70px; padding: 3px 6px; }
			h4 { margin: 10px 0 2px; text-align: center; font-size: 13px; opacity: .8; }
			.role { display: flex; align-items: center; gap: 8px; }
			.role img { width: 25px; height: 35px; object-fit: contain; }
			.reset { margin-top: 6px; }
		</style>
		<div class="dialog">
			<div class="row"><span>{"Включить фильтр"}</span><input type="checkbox" checked={filter().enabled} onChange={(event) => store.update(data => { data.enabled = event.currentTarget.checked; })} /></div>
			@for (const count of COUNTS) {
				<div class="row"><span>{count.label}</span><input type="number" value={filter()[count.key]} onChange={(event) => change(data => { data[count.key] = parseInt(event.currentTarget.value, 10) || 0; })} /></div>
			}
			@for (const flag of FLAGS) {
				<div class="row"><span>{flag.label}</span><input type="checkbox" checked={filter()[flag.key]} onChange={(event) => change(data => { data[flag.key] = event.currentTarget.checked; })} /></div>
			}
			<h4>{"Статус комнаты"}</h4>
			<div class="row"><span>{"Идёт регистрация"}</span><input type="checkbox" checked={filter().isRegistration} onChange={(event) => change(data => { data.isRegistration = event.currentTarget.checked; })} /></div>
			<div class="row"><span>{"Игра началась"}</span><input type="checkbox" checked={filter().isStarted} onChange={(event) => change(data => { data.isStarted = event.currentTarget.checked; })} /></div>
			<h4>{"Команда мафии"}</h4>
			@for (const role of MAFIA) {
				<div class="row"><span class="role"><img src={roleImages()[role.id]} alt="" />{role.name}</span><input type="checkbox" checked={filter().roles.includes(role.id)} onChange={() => toggleRole(role.id)} /></div>
			}
			<h4>{"Команда мирных жителей"}</h4>
			@for (const role of PEACEFUL) {
				<div class="row"><span class="role"><img src={roleImages()[role.id]} alt="" />{role.name}</span><input type="checkbox" checked={filter().roles.includes(role.id)} onChange={() => toggleRole(role.id)} /></div>
			}
			<div class="row"><span>{"Только комнаты без этих ролей"}</span><input type="checkbox" checked={filter().noRoles} onChange={(event) => change(data => { data.noRoles = event.currentTarget.checked; })} /></div>
			<button class="reset" onClick={() => store.set({ ...defaultFilter(), sortRules: store.data.sortRules })}>{"Сбросить"}</button>
			<button onClick={() => close()}>{"Готово"}</button>
		</div>
	</>
}
