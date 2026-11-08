import { createSignal } from "@common/ui";
import { buildRemoteReport } from "@common/panic";
import { getReportLogs } from "@common/logger";
import { version } from "@common/version";
import { detectBrowser, detectPlatform, detectSite } from "../domain/platform";
import type { GameContext } from "../context";

/** экран краха: отчёт уходит разработчику сам (без трафика и сообщений), игра не работает, пока окно не откроют заново */
export function CrashScreen({ ctx }: { ctx: GameContext }) @{
	const crash = ctx.crash()!;
	const report = buildRemoteReport(crash, {
		version, width: window.innerWidth, height: window.innerHeight, pixelRatio: window.devicePixelRatio,
		platform: detectPlatform(), browser: detectBrowser(), site: detectSite(), logs: getReportLogs()
	});
	const [state, setState] = createSignal<"sending" | "sent" | "failed">("sending");

	const send = async () => {
		setState("sending");
		setState(await ctx.bafia.reportCrash(report) ? "sent" : "failed");
	};
	void send();

	<>
		<style>
			.crash { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 100%; box-sizing: border-box; padding: 16px 12px; overflow: auto; background: #262e40; color: #fff; font-family: ui-monospace, monospace; text-align: center; }
			.crash .status { opacity: .85; font-size: 14px; max-width: 420px; line-height: 1.4; }
			.crash .status.sent { color: #8de08d; }
			.crash .status.failed { color: #ffb4a8; }
			.crash a { color: lightblue; user-select: text; -webkit-user-select: text; }
			.buttons { display: flex; gap: 8px; margin-top: 6px; }
		</style>
		<div class="crash">
			<div>{"Упс.. Бафия крашнулась"}</div>
			@if (state() == "sending") {
				<div class="status">{"Отправляю отчёт разработчику…"}</div>
			} @else if (state() == "sent") {
				<div class="status sent">{"Отчёт отправлен разработчику, спасибо! Закрой окно и открой игру заново."}</div>
			} @else {
				<>
					<div class="status failed">{"Не получилось отправить отчёт: нет связи с сервером Бафии. Попробуй ещё раз или напиши разработчику:"}</div>
					<a href="https://t.me/bafiaonlinebot" target="_blank">{"t.me/bafiaonlinebot"}</a>
				</>
			}
			<div class="buttons">
				@if (state() == "failed") {
					<button onClick={() => void send()}>{"Отправить ещё раз"}</button>
				}
				<button onClick={() => void ctx.host.window.close(true)}>{"Закрыть окно"}</button>
			</div>
		</div>
	</>
}
