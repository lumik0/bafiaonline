import { createSignal } from "@common/ui";
import type { InstalledMod } from "../../mods/manager";

/** код мода: можно прочитать и сверить хеш с опубликованным автором */
export function ModCode({ mod, close }: { mod: InstalledMod, close: () => void }) @{
	const BUILT = "";
	const files = Object.keys(mod.sources ?? {});
	const [current, setCurrent] = createSignal(BUILT);
	const [query, setQuery] = createSignal("");
	const [found, setFound] = createSignal("");
	let area!: HTMLTextAreaElement;

	const text = () => current() == BUILT ? mod.code : mod.sources?.[current()] ?? "";

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(text());
		} catch {
			area.select();
			document.execCommand("copy");
		}
	};

	/** следующее совпадение после выделенного (по кругу): выделяет его и прокручивает к нему */
	const search = () => {
		const needle = query().toLowerCase();
		if(!needle) return setFound("");
		const haystack = text().toLowerCase();
		let index = haystack.indexOf(needle, area.selectionEnd);
		if(index < 0) index = haystack.indexOf(needle);
		if(index < 0) return setFound("Не найдено");

		area.setSelectionRange(index, index + needle.length);
		const line = text().slice(0, index).split("\n").length - 1;
		area.scrollTop = Math.max(0, line * (parseFloat(getComputedStyle(area).lineHeight) || 15) - area.clientHeight / 2);
		setFound("Строка " + (line + 1));
	};

	<>
		<style>
			.hash { font: 11px ui-monospace, monospace; word-break: break-all; margin-bottom: 6px; user-select: text; -webkit-user-select: text; }
			.bar { display: flex; gap: 6px; margin-bottom: 6px; }
			.bar select { max-width: 40%; }
			.bar input { flex: 1; min-width: 0; padding: 3px 6px; }
			.found { font-size: 12px; opacity: .8; align-self: center; white-space: nowrap; }
			textarea { width: 100%; height: 260px; box-sizing: border-box; font: 11px/1.4 ui-monospace, monospace; user-select: text; -webkit-user-select: text; white-space: pre; }
			.note { font-size: 11px; opacity: .7; margin-top: 4px; }
			.buttons { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
		</style>
		<div class="hash">{"SHA-256 кода: " + mod.sha256}</div>
		<div class="bar">
			@if (files.length) {
				<select onChange={(event) => { setCurrent(event.currentTarget.value); setFound(""); }}>
					<option value={BUILT} selected={current() == BUILT}>{"Код мода (то, что выполняется)"}</option>
					@for (const file of files) {
						<option value={file} selected={current() == file}>{"Исходник: " + file}</option>
					}
				</select>
			}
			<input type="text" placeholder="Поиск" value={query()} onInput={(event) => setQuery(event.currentTarget.value)} onKeyDown={(event) => { if(event.key == "Enter") search(); }} />
			<button onClick={search}>{"Найти"}</button>
			<span class="found">{found()}</span>
		</div>
		<textarea ref={area} readonly value={text()}></textarea>
		@if (current() != BUILT) {
			<div class="note">{"Исходники приложил автор. Игра не проверяет, что они соответствуют коду мода: выполняется только «Код мода»."}</div>
		}
		<div class="buttons">
			<button onClick={copy}>{"Скопировать"}</button>
			<button onClick={() => close()}>{"Закрыть"}</button>
		</div>
	</>
}
