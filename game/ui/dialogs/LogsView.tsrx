import { getLogs } from "@common/logger";
import { createSignal } from "@common/ui";

/** журнал игры; «только неизвестные» - пакеты без схемы, их стоит присылать */
export function LogsView({ close }: { close: () => void }) @{
	const [onlyUnknown, setOnlyUnknown] = createSignal(false);
	const text = () => getLogs().filter(line => !onlyUnknown() || / ← unknown | ПАКЕТ НЕ ПОДОШЁЛ /.test(line)).join("\n");
	let area: HTMLTextAreaElement;

	const copy = async () => {
		area.select();
		try {
			await navigator.clipboard.writeText(text());
		} catch {
			document.execCommand("copy");
		}
	};

	<>
		<style>
			textarea { width: 100%; height: 260px; box-sizing: border-box; font: 11px/1.4 ui-monospace, monospace; user-select: text; -webkit-user-select: text; }
			.filter { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 13px; }
			.filter input { zoom: 1.3; }
			.buttons { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
		</style>
		<label class="filter"><input type="checkbox" checked={onlyUnknown()} onChange={(event) => setOnlyUnknown(event.currentTarget.checked)} />{"Только неизвестные пакеты"}</label>
		<textarea ref={area} readonly value={text()}></textarea>
		<div class="buttons">
			<button onClick={copy}>{"Скопировать"}</button>
			<button onClick={() => close()}>{"Закрыть"}</button>
		</div>
	</>
}
