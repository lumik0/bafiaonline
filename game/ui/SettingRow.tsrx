/** строка настроек: название слева, элемент управления справа */
export function SettingRow({ label, children }: { label: string, children?: unknown }) @{
	<>
		<style>
			.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 35px; flex: none; padding: 6px 14px; border-radius: 15px; background: var(--surface); }
			.label { font-size: 16px; color: var(--text-dark); }
			.control { display: flex; align-items: center; gap: 8px; }
		</style>
		<div class="row">
			<span class="label">{label}</span>
			<div class="control">{children}</div>
		</div>
	</>
}
