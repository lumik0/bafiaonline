import { buildReport } from "@common/panic";
import { getLogs } from "@common/logger";
import { version } from "@common/version";
import type { GameContext } from "../context";

/** экран краха: отчёт для разработчика; игра не работает, пока окно не откроют заново */
export function CrashScreen({ ctx }: { ctx: GameContext }) @{
	const crash = ctx.crash()!;
	const report = buildReport(crash, {
		version, width: window.innerWidth, height: window.innerHeight, pixelRatio: window.devicePixelRatio,
		location: location.href, userAgent: navigator.userAgent, logs: getLogs()
	});
	let area: HTMLTextAreaElement;
	let copied = false;

	const copy = async () => {
		area.select();
		try {
			await navigator.clipboard.writeText(report);
		} catch {
			document.execCommand("copy");
		}
		copied = true;
		button.textContent = "Скопировано";
	};
	let button: HTMLButtonElement;

	<>
		<style>
			.crash { display: flex; flex-direction: column; align-items: center; gap: 8px; height: 100%; box-sizing: border-box; padding: 16px 12px; overflow: auto; background: #262e40; color: #fff; font-family: ui-monospace, monospace; text-align: center; }
			.crash a { color: lightblue; user-select: text; -webkit-user-select: text; }
			textarea { width: 100%; flex: 1; min-height: 120px; box-sizing: border-box; font: 11px/1.4 ui-monospace, monospace; user-select: text; -webkit-user-select: text; }
			.buttons { display: flex; gap: 8px; }
		</style>
		<div class="crash">
			<div>{"Упс.. Бафия крашнулась"}</div>
			<div>{"Отправьте этот текст разработчику Бафии"}</div>
			<a href="https://t.me/bafiaonlinebot" target="_blank">{"t.me/bafiaonlinebot"}</a>
			<textarea ref={area} readonly value={report} onClick={() => { if(!copied) void copy(); }}></textarea>
			<div class="buttons">
				<button ref={button} onClick={() => void copy()}>{"Скопировать"}</button>
				<button onClick={() => void ctx.host.window.close(true)}>{"Закрыть окно"}</button>
			</div>
		</div>
	</>
}
