import { useContext } from "@common/ui";
import { Icon } from "./Icon.tsrx";
import { WindowControlsContext } from "./window-controls";

/**
 * красная шапка экрана: назад (если задан onBack), заголовок, справа что-нибудь своё
 * Props не разбираются на переменные: иначе заголовок (счётчик друзей и т. п.) не обновлялся бы
 */
export function AppBar(props: { title: string, subtitle?: string, keepCase?: boolean, onBack?: () => void, right?: unknown, stretch?: boolean }) @{
	const controls = useContext(WindowControlsContext);
	<>
		<style>
			.bar { flex: none; display: flex; align-items: center; gap: var(--appbar-gap, 12px); min-height: var(--appbar-height, 56px); box-sizing: border-box; padding: var(--appbar-padding, 4px 16px); background: var(--header-bg); color: var(--header-text); box-shadow: var(--appbar-shadow, 0 2px 6px rgba(0, 0, 0, .35)); position: relative; z-index: 1; }
			.bar.root { padding: var(--appbar-padding-root, 4px 16px); }
			.titles { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
			/* stretch: правая часть занимает всё свободное место шапки, а заголовок - не больше половины */
			.titles.narrow { flex: 0 1 auto; max-width: 50%; }
			.right { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
			.title { font-size: var(--appbar-title-size, 20px); font-weight: var(--appbar-title-weight, 500); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
			.subtitle { font-size: 13px; opacity: .9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
			.back { padding: var(--appbar-icon-padding, 6px); background: transparent; border: none; border-radius: 50%; display: flex; color: inherit; }
			.close { padding: var(--appbar-icon-padding, 6px); background: transparent; border: none; border-radius: 50%; display: flex; color: inherit; margin-right: -6px; }
			.close:enabled:hover { background: rgba(255, 255, 255, .15); }
			.back:enabled:hover { background: rgba(255, 255, 255, .15); }
		</style>
		<div class={props.onBack ? "bar" : "bar root"}>
			@if (props.onBack) {
				<button class="back" onClick={props.onBack} aria-label="Назад"><Icon name="back" size={24} /></button>
			}
			<div class={props.stretch ? "titles narrow" : "titles"}>
				<div class="title" data-keep={props.keepCase ? "" : undefined}>{props.title}</div>
				@if (props.subtitle) {
					<div class="subtitle">{props.subtitle}</div>
				}
			</div>
			@if (props.stretch) {
				<div class="right">{props.right}</div>
			} @else {
				{props.right}
			}
			@if (controls?.showClose) {
				<button class="close" onClick={() => controls.close()} aria-label="Закрыть игру" title="Закрыть игру"><Icon name="close" size={22} /></button>
			}
		</div>
	</>
}
