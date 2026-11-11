/**
 * строка настроек: название (и пояснение под ним) слева, элемент управления справа; строки живут внутри `SettingGroup`
 * props не разбираются на переменные: иначе название, которое меняется (срок премиума), не обновлялось бы
 */
export function SettingRow(props: { label: string, hint?: string, children?: unknown }) @{
	<>
		<style>
			.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 46px; flex: none; padding: 8px 14px; border-bottom: 1px solid var(--divider, rgba(128, 128, 128, .22)); }
			.row:last-child { border-bottom: none; }
			.text { display: flex; flex-direction: column; min-width: 0; }
			.label { font-size: 16px; color: var(--text-dark); }
			.hint { margin-top: 2px; font-size: 12px; line-height: 1.3; color: var(--text-dark); opacity: .62; }
			.control { flex: none; display: flex; align-items: center; justify-content: flex-end; gap: 8px; max-width: 60%; }
		</style>
		<div class="row">
			<div class="text">
				<span class="label">{props.label}</span>
				@if (props.hint) {
					<span class="hint">{props.hint}</span>
				}
			</div>
			<div class="control">{props.children}</div>
		</div>
	</>
}

/** группа настроек: заголовок над скруглённой карточкой, внутри строки с разделителями */
export function SettingGroup(props: { title?: string, children?: unknown }) @{
	<>
		<style>
			.group { display: flex; flex-direction: column; gap: 5px; flex: none; }
			.title { padding: 0 14px; font-size: 12px; font-weight: 700; letter-spacing: .04em; color: var(--text-dark); opacity: .6; }
			.card { overflow: hidden; border-radius: var(--card-radius, 15px); background: var(--surface); }
		</style>
		<div class="group">
			@if (props.title) {
				<div class="title" data-keep>{props.title}</div>
			}
			<div class="card">{props.children}</div>
		</div>
	</>
}

/**
 * переключатель вместо квадратной галочки. `onChange` получает новое значение и сам элемент: если выбор отменили
 * (например, отказались от согласия), элемент можно вернуть обратно
 */
export function Toggle(props: { checked: boolean, label: string, onChange: (value: boolean, input: HTMLInputElement) => void }) @{
	<>
		<style>
			.switch { position: relative; display: inline-block; flex: none; width: 50px; height: 30px; cursor: pointer; }
			.switch input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; z-index: 1; }
			.track { position: absolute; inset: 0; border-radius: 15px; background: var(--switch-off-track, rgba(128, 128, 128, .45)); box-shadow: inset 0 0 0 var(--switch-outline, 0px) rgba(128, 128, 128, .95); transition: background .18s, box-shadow .18s; }
			.track::after { content: ""; position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; border-radius: 50%; background: var(--switch-off-thumb, #fff); box-shadow: 0 1px 3px rgba(0, 0, 0, .35); transform: scale(var(--switch-off-scale, 1)); transition: transform .18s, background .18s; }
			input:checked + .track { background: var(--accent); box-shadow: none; }
			input:checked + .track::after { transform: translateX(20px); background: #fff; }
			input:focus-visible + .track { outline: 2px solid var(--accent); outline-offset: 2px; }
		</style>
		<label class="switch">
			<input type="checkbox" role="switch" aria-label={props.label} checked={props.checked} onChange={(event) => props.onChange(event.currentTarget.checked, event.currentTarget)} />
			<span class="track"></span>
		</label>
	</>
}
