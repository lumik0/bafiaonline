import { ErrorBoundary, fromEvents, injectStyle, onCleanup, onMount } from "@common/ui";
import { DialogLayer } from "@common/ui/dialog/DialogLayer.tsrx";
import { MenuLayer } from "@common/ui/menu/MenuLayer.tsrx";
import { NavHost } from "@common/ui/nav/NavHost.tsrx";
import { CrashScreen } from "./CrashScreen.tsrx";
import { WindowControlsContext } from "./window-controls";
import type { GameContext } from "../context";
import type { Routes } from "../routes";
import type { Screens } from "@common/ui/nav/navigator";

/**
 * «Интерфейс с маленькой буквы»: надписи, кроме текста игроков
 * такие места помечены атрибутом data-keep
 */
injectStyle("lowercase", `
[data-lowercase="true"] { text-transform: lowercase; }
/* кнопки и списки по умолчанию не наследуют text-transform */
[data-lowercase="true"] button, [data-lowercase="true"] select, [data-lowercase="true"] option { text-transform: lowercase; }
[data-lowercase="true"] [data-keep], [data-lowercase="true"] [data-keep] * { text-transform: none; }
[data-lowercase="true"] input, [data-lowercase="true"] textarea { text-transform: none; }
[data-lowercase="true"] input::placeholder, [data-lowercase="true"] textarea::placeholder { text-transform: lowercase; }
`);

/** корень игры: экраны, окна поверх них и масштаб из настроек */
export function GameRoot({ ctx, screens }: { ctx: GameContext, screens: Screens<Routes> }) @{
	const zoom = fromEvents(ctx.settings, "change", () => ctx.settings.data.window.zoom || 1);
	const lowercase = fromEvents(ctx.settings, "change", () => ctx.settings.data.lowercase);
	// фон по умолчанию у всех экранов - как в меню; пока картинка не загрузилась, обычный фон темы
	const picture = fromEvents(ctx.assets, "change", () => ctx.assets.url("textures/backgrounds/menu3.png"));
	const background = () => picture() ? "linear-gradient(var(--menu-overlay), var(--menu-overlay)), url(" + picture() + ") center / cover" : "var(--bg)";

	// без заголовка окна кнопку закрытия рисует шапка экрана
	const controls = {
		showClose: !ctx.host.window.options.titleBar,
		close: () => void ctx.dialogs.confirm("Закрыть игру?", { yes: "Закрыть" }).then(ok => ok && ctx.host.window.close())
	};

	// Esc и клавиша ` («ё»/тильда) - «назад», как на Android. Окно поверх экрана Esc обрабатывает само;
	// клавиша ` не срабатывает в поле ввода (это обычный символ) и в неактивном окне игры
	onMount(() => {
		const keydown = (event: KeyboardEvent) => {
			const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
			const isBack = event.key == "Escape" || (event.code == "Backquote" && !typing);
			if(!isBack || ctx.dialogs.manager.isOpen || ctx.dialogs.menu.isOpen || !ctx.host.window.active) return;
			event.preventDefault();
			void ctx.back();
		};
		document.addEventListener("keydown", keydown);
		onCleanup(() => document.removeEventListener("keydown", keydown));
	});

	<>
		<style>
			.root { position: absolute; left: 0; top: 0; overflow: hidden; transform-origin: 0 0; }
		</style>
		<div class="root" data-lowercase={lowercase() ? "true" : "false"} style={{ "--screen-bg": background(), transform: "scale(" + zoom() + ")", width: "calc(100% / " + zoom() + ")", height: "calc(100% / " + zoom() + ")" }}>
			@if (ctx.crash()) {
				<CrashScreen ctx={ctx} />
			} @else {
				<>
					<WindowControlsContext.Provider value={controls}>
						<ErrorBoundary fallback={(error: unknown) => <ReportCrash ctx={ctx} error={error} />}>
							<NavHost navigator={ctx.nav} screens={screens} />
						</ErrorBoundary>
					</WindowControlsContext.Provider>
					<DialogLayer manager={ctx.dialogs.manager} />
					<MenuLayer manager={ctx.dialogs.menu} />
				</>
			}
		</div>
	</>
}

/** ошибка при отрисовке экрана: передаём её в панику (показывается экран краха) */
function ReportCrash({ ctx, error }: { ctx: GameContext, error: unknown }) @{
	// паника меняет состояние: делаем это не во время отрисовки, а сразу после
	queueMicrotask(() => ctx.panic(error, "Ошибка при отрисовке экрана"));
	<div></div>
}
