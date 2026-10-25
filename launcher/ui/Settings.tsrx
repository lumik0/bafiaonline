import { createSignal, fromEvents } from "@common/ui";
import { isMobile } from "@common/utils/mobile";
import type { LauncherModel } from "../model";

export function Settings({ model, openTheme }: { model: LauncherModel, openTheme: () => void }) @{
	const options = fromEvents(model, "change", () => model.options);
	// масштаб применяем на отпускании ползунка, чтобы он не уезжал из-под пальца
	const [pending, setPending] = createSignal<number | undefined>(undefined);

	const download = (name: string, text: string) => {
		const link = document.createElement("a");
		link.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
		link.download = name;
		link.click();
		URL.revokeObjectURL(link.href);
	};
	const pickFile = () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "application/json";
		input.onchange = async () => {
			const file = input.files?.[0];
			if(file) await model.importAccounts(await file.text());
		};
		input.click();
	};

	<>
		<style>
			.settings { display: flex; flex-direction: column; gap: 6px; padding: 10px; }
			.row { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 32px; padding: 0 10px; border-radius: 8px; background: rgba(255, 255, 255, .08); font-size: 13px; }
			.row input { zoom: 1.3; }
		</style>
		<div class="settings">
			<div class="row">
				<span>{"Масштаб интерфейса"}</span>
				<span class="value">{(pending() ?? options().uiScale).toFixed(1) + "×"}</span>
				<input type="range" min=".8" max="2.5" step=".1" value={options().uiScale} onInput={(event) => setPending(Number(event.currentTarget.value))} onChange={(event) => { setPending(undefined); void model.setScale(Number(event.currentTarget.value)); }} />
			</div>
			@if (!isMobile()) {
				<div class="row"><span>{"Оформление"}</span><button onClick={openTheme}>{"Изменить"}</button></div>
			}
			@if (!isMobile()) {
				<>
				<div class="row">
					<span>{"Окна на весь экран"}</span>
					<input type="checkbox" checked={options().windowsInFS} onChange={(event) => void model.setOption("windowsInFS", event.currentTarget.checked)} />
				</div>
				<div class="row">
					<span>{"Скрывать док"}</span>
					<input type="checkbox" checked={options().hideDock} onChange={(event) => void model.setOption("hideDock", event.currentTarget.checked)} />
				</div>
				</>
			}
			<div class="row">
				<span>{"Режим разработчика"}</span>
				<input type="checkbox" checked={options().devMode} onChange={(event) => void model.setOption("devMode", event.currentTarget.checked)} />
			</div>
			<div class="row">
				<span>{"Аккаунты"}</span>
				<span>
					<button onClick={() => void model.exportAccounts(download)}>{"Экспорт"}</button>
					<button onClick={pickFile}>{"Импорт"}</button>
				</span>
			</div>
			<div class="row"><span>{"Из старой версии"}</span><button onClick={() => void model.importFromLegacy()}>{"Импорт аккаунтов"}</button></div>
			<div class="row"><span>{"Все данные"}</span><button onClick={() => void model.eraseEverything()}>{"Очистить"}</button></div>
		</div>
	</>
}
