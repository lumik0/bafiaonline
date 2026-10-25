import { fromEvents } from "@common/ui";
import { highestRisk, parsePackage, permissions, riskLabels, type Permission, type Risk } from "@mods/index";
import { ModCode } from "../ui/dialogs/ModCode.tsrx";
import { ModPermissions } from "../ui/dialogs/ModPermissions.tsrx";
import type { ModInfo } from "../mods/manager";
import { AppBar } from "../ui/AppBar.tsrx";
import type { GameContext } from "../context";

const RISK_COLORS: Record<Risk, string> = { critical: "#e5484d", high: "#f5a524", medium: "#e5c82e", low: "#3dd68c" };
const STATUS: Record<ModInfo["status"], string> = { running: "Работает", stopped: "Выключен", crashed: "Остановлен из-за ошибки" };

/** моды: установка из файла, включение, разрешения по одному, панель мода и его сообщения */
export function ModsScreen({ ctx }: { ctx: GameContext }) @{
	const mods = fromEvents(ctx.mods, "change", () => ctx.mods.list.map(info => ({
		...info, risk: highestRisk(info.mod.manifest.permissions)
	})));

	const describe = (list: readonly Permission[]) => list.length
		? list.map(permission => `• ${permissions[permission].label} (${riskLabels[permissions[permission].risk]})`).join("\n")
		: "Мод не просит разрешений";

	const pickFile = () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".json,application/json";
		input.onchange = async () => {
			const file = input.files?.[0];
			if(!file) return;
			try {
				const pack = parsePackage(await file.text());
				const old = ctx.mods.find(pack.manifest.id);
				const fresh = pack.manifest.permissions.filter(permission => !old?.granted.includes(permission));
				const ok = await ctx.dialogs.confirm(
					`${old ? "Обновить" : "Установить"} мод «${pack.manifest.name}» ${pack.manifest.version}?\n\nОн просит:\n${describe(fresh)}\n\nМод работает в изолированной песочнице. Разрешения можно отключить в любой момент.`,
					{ title: "МОД", yes: old ? "Обновить" : "Установить" }
				);
				if(ok) await ctx.mods.install(pack, true);
			} catch(error) {
				await ctx.dialogs.alert(error instanceof Error ? error.message : String(error), { title: "Не удалось установить мод" });
			}
		};
		input.click();
	};

	void ctx.mods.checkUpdates();

	const update = async (info: ModInfo) => {
		try {
			const pack = await ctx.mods.prepareUpdate(info.mod.manifest.id);
			const fresh = pack.manifest.permissions.filter(permission => !info.mod.granted.includes(permission));
			const ok = await ctx.dialogs.confirm(
				`Обновить «${info.mod.manifest.name}» ${info.mod.manifest.version} → ${pack.manifest.version}?\n\nНовые разрешения (будут выключены, пока ты их не включишь):\n${describe(fresh)}\n\nФайл скачан и проверен по хешу из описания автора.`,
				{ title: "ОБНОВЛЕНИЕ МОДА", yes: "Обновить" }
			);
			if(ok) await ctx.mods.install(pack, false);
		} catch(error) {
			await ctx.dialogs.alert(error instanceof Error ? error.message : String(error), { title: "Не удалось обновить мод" });
		}
	};

	const showPermissions = (info: ModInfo) => void ctx.dialogs.manager.open({
		title: "РАЗРЕШЕНИЯ: " + info.mod.manifest.name.toUpperCase(),
		render: close => ModPermissions({ ctx, id: info.mod.manifest.id, close })
	});

	const showCode = (info: ModInfo) => void ctx.dialogs.manager.open({
		title: "КОД: " + info.mod.manifest.name.toUpperCase(), wide: true,
		render: close => ModCode({ mod: info.mod, close })
	});

	const remove = async (info: ModInfo) => {
		if(await ctx.dialogs.confirm(`Удалить мод «${info.mod.manifest.name}» вместе с его данными?`, { yes: "Удалить" })) await ctx.mods.remove(info.mod.manifest.id);
	};

	<>
		<style>
			.page { display: flex; flex-direction: column; height: 100%; }
			.list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; }
			.card { display: flex; flex-direction: column; gap: 4px; padding: 7px 10px; border-radius: 10px; background: var(--surface); color: var(--text-dark); border-left: 5px solid var(--risk); }
			.head { display: flex; align-items: center; gap: 8px; }
			.head input { zoom: 1.3; }
			.name { flex: 1; min-width: 0; font-size: 15px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
			.version { font-size: 12px; opacity: .7; }
			.sub { font-size: 12px; opacity: .8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
			.sub.crashed { color: #b3202a; opacity: 1; white-space: normal; }
			.actions { display: flex; gap: 6px; }
			.actions button { padding: 3px 10px; font-size: 13px; }
			.update { display: flex; align-items: center; gap: 8px; padding: 3px 8px; border-radius: 8px; background: rgba(61, 214, 140, .35); font-size: 13px; }
			.update.bad { background: rgba(229, 72, 77, .3); }
			.panel { padding: 8px; border-radius: 8px; background: rgba(255, 255, 255, .35); display: flex; flex-direction: column; gap: 6px; }
			.panel b { font-size: 13px; }
			.empty { padding: 40px 14px; text-align: center; opacity: .8; line-height: 1.5; white-space: pre-line; }
			.official { font-size: 11px; padding: 1px 7px; border-radius: 8px; background: rgba(60, 120, 220, .35); }
			.risk { font-size: 11px; padding: 1px 7px; border-radius: 8px; color: #1b1b1b; background: var(--risk); }
		</style>
		<div class="page">
			<AppBar title="Моды" onBack={() => ctx.nav.pop()} right={<><button onClick={() => void ctx.mods.checkUpdates(true)}>{"Обновления"}</button><button onClick={pickFile}>{"Установить"}</button></>} />
			<div class="list">
				@for (const info of mods()) {
					<div class="card" style={{ "--risk": RISK_COLORS[info.risk] }}>
						<div class="head">
							<input type="checkbox" checked={info.mod.enabled} onChange={(event) => void ctx.mods.setEnabled(info.mod.manifest.id, event.currentTarget.checked)} />
							<span class="name" data-keep>{info.mod.manifest.name}</span>
							@if (info.builtIn) {
								<span class="official" title="Есть у каждого игрока. Можно выключить, но не удалить">{"встроенный"}</span>
							}
							<span class="risk">{riskLabels[info.risk]}</span>
							<span class="version">{info.mod.manifest.version}</span>
						</div>
						<div class={"sub " + info.status}>{(info.error ? STATUS[info.status] + ": " + info.error : STATUS[info.status]) + (info.mod.manifest.description ? " - " + info.mod.manifest.description : "")}</div>
						@if (info.update) {
							<div class="update">
								<span>{"Доступна версия " + info.update.version}</span>
								<button onClick={() => void update(info)}>{"Обновить"}</button>
							</div>
						}
						@if (info.updateError) {
							<div class="update bad">{"Проверка обновлений: " + info.updateError}</div>
						}
						@if (info.panel) {
							<div class="panel">
								<b>{info.panel.title}</b>
								@for (const block of info.panel.blocks) {
									@if (block.type == "button") {
										<button onClick={() => ctx.mods.panelAction(info.mod.manifest.id, block.id)}>{block.text}</button>
									} @else {
										<div>{block.text}</div>
									}
								}
							</div>
						}
						<div class="actions">
							<button onClick={() => showPermissions(info)}>{"Разрешения (" + info.mod.granted.length + "/" + info.mod.manifest.permissions.length + ")"}</button>
							<button onClick={() => showCode(info)}>{"Код"}</button>
							@if (!info.builtIn) {
								<button onClick={() => void remove(info)}>{"Удалить"}</button>
							}
						</div>
					</div>
				} @empty {
					<div class="empty">{"Модов нет.\nМод - это файл .json с кодом и списком разрешений.\nУстанавливай только те, которым доверяешь."}</div>
				}
			</div>
		</div>
	</>
}
