import { createSignal, onMount } from "@common/ui";
import { BAFIA_LIMITS, type DeviceInfo } from "@common/bafia/protocol";
import type { GameContext } from "../../context";

const platforms: Record<string, string> = { ios: "iPhone / iPad", android: "Android", windows: "Windows", macos: "Mac", linux: "Linux", other: "Другое", unknown: "Неизвестно" };
const browsers: Record<string, string> = { safari: "Safari", chrome: "Chrome", firefox: "Firefox", edge: "Edge", opera: "Opera", yandex: "Яндекс", samsung: "Samsung", app: "Приложение", other: "", unknown: "" };

const when = (time: number) => new Date(time).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** устройства, на которых активирован код премиума: можно убрать лишние, чтобы освободить место (например, у одного айфона несколько записей из-за разных ключей установки) */
export function DevicesDialog({ ctx, code, close }: { ctx: GameContext, code?: string, close: () => void }) @{
	const [list, setList] = createSignal<DeviceInfo[] | undefined>(undefined);
	const [failed, setFailed] = createSignal(false);
	const [busy, setBusy] = createSignal(false);
	const load = async () => {
		const result = await ctx.bafia.devices(code);
		setFailed(!result);
		setList(result);
	};
	onMount(() => void load());
	const remove = async (device: DeviceInfo) => {
		const label = [platforms[device.platform] ?? device.platform, browsers[device.browser]].filter(Boolean).join(" · ");
		const agreed = await ctx.dialogs.confirm(device.current ? "Это устройство, на котором ты сейчас. Премиум на нём отключится, пока не введёшь код снова. Убрать?" : `Убрать устройство «${label}»? Место освободится, а на нём премиум отключится.`, { title: "УБРАТЬ УСТРОЙСТВО", yes: "Убрать", no: "Отмена" });
		if(!agreed) return;
		setBusy(true);
		const result = await ctx.bafia.removeDevice(device.id, code);
		setBusy(false);
		if(result) setList(result);
		else await ctx.dialogs.alert("Не получилось: сервер Бафии недоступен.", { title: "УСТРОЙСТВА" });
	};
	<>
		<style>
			.hint { margin: 0 0 10px; font-size: 13px; opacity: .8; }
			.rows { display: flex; flex-direction: column; gap: 8px; max-height: 55vh; overflow-y: auto; }
			.row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; background: rgba(128, 128, 128, .18); }
			.info { flex: 1; min-width: 0; font-size: 13px; line-height: 1.35; }
			.name { font-weight: 600; font-size: 14px; }
			.name b { font-size: 11px; margin-left: 6px; padding: 1px 6px; border-radius: 6px; background: var(--accent); color: #fff; font-weight: 600; }
			.dim { opacity: .7; overflow-wrap: anywhere; }
			.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
		</style>
		@if (list()) {
			<>
				<p class="hint">{`Код работает на ${BAFIA_LIMITS.codeDevices} устройствах (занято ${list()!.length}). Одно и то же устройство может быть в списке несколько раз, если сбрасывались данные сайта: оставь свежее, а старые убери.`}</p>
				<div class="rows">
					@for (const device of list()!) {
						<div class="row">
							<div class="info">
								<div class="name">
									{[platforms[device.platform] ?? device.platform, browsers[device.browser]].filter(Boolean).join(" · ")}
									@if (device.current) {
										<b>{"это устройство"}</b>
									}
								</div>
								<div class="dim">{[device.nick, device.site, device.version ? "v" + device.version : ""].filter(Boolean).join(" · ")}</div>
								<div class="dim">{`в сети ${when(device.last)}, добавлено ${when(device.since)}`}</div>
							</div>
							<button disabled={busy()} onClick={() => void remove(device)}>{"Убрать"}</button>
						</div>
					}
				</div>
			</>
		} @else if (failed()) {
			<p class="hint">{"Не получилось загрузить список: сервер Бафии недоступен или код не подошёл."}</p>
		} @else {
			<p class="hint">{"Загрузка…"}</p>
		}
		<div class="actions">
			<button class="dark-gray" onClick={close}>{"Закрыть"}</button>
		</div>
	</>
}
