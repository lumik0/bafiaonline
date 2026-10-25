import { useContext } from "@common/ui";
import { Icon } from "./Icon.tsrx";
import { WindowControlsContext } from "./window-controls";

/**
 * красная шапка экрана: назад (если задан onBack), заголовок, справа что-нибудь своё
 * Props не разбираются на переменные: иначе заголовок (счётчик друзей и т. п.) не обновлялся бы
 */
export function AppBar(props: { title: string, subtitle?: string, keepCase?: boolean, onBack?: () => void, right?: unknown }) @{
	const controls = useContext(WindowControlsContext);
	<>
		<style>
			.bar { flex: none; display: flex; align-items: center; gap: 12px; min-height: 56px; box-sizing: border-box; padding: 4px 16px; background: var(--header-bg); color: var(--header-text); box-shadow: 0 2px 6px rgba(0, 0, 0, .35); position: relative; z-index: 1; }
			.titles { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
			.title { font-size: 20px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
			.subtitle { font-size: 13px; opacity: .9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
			.back { padding: 6px; background: transparent; border: none; border-radius: 50%; display: flex; color: inherit; }
			.close { padding: 6px; background: transparent; border: none; border-radius: 50%; display: flex; color: inherit; margin-right: -6px; }
			.close:enabled:hover { background: rgba(255, 255, 255, .15); }
			.back:enabled:hover { background: rgba(255, 255, 255, .15); }
		</style>
		<div class="bar">
			@if (props.onBack) {
				<button class="back" onClick={props.onBack} aria-label="Назад"><Icon name="back" size={24} /></button>
			}
			<div class="titles">
				<div class="title" data-keep={props.keepCase ? "" : undefined}>{props.title}</div>
				@if (props.subtitle) {
					<div class="subtitle">{props.subtitle}</div>
				}
			</div>
			{props.right}
			@if (controls?.showClose) {
				<button class="close" onClick={() => controls.close()} aria-label="Закрыть игру" title="Закрыть игру"><Icon name="close" size={22} /></button>
			}
		</div>
	</>
}
