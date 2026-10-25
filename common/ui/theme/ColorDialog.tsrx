import { createSignal } from "@common/ui";
import type { ThemeManager, TokenKey } from "@common/ui/theme";
import { formatColor, parseColor } from "./colors";

/** выбор цвета для одного токена; изменения видны сразу */
export function ColorDialog({ theme, token, close }: { theme: ThemeManager, token: TokenKey, close: () => void }) @{
	const start = parseColor(theme.values[token]) ?? { hex: "#000000", alpha: 1 };
	const [hex, setHex] = createSignal(start.hex);
	const [alpha, setAlpha] = createSignal(start.alpha);
	const [text, setText] = createSignal(theme.values[token]);

	const apply = (nextHex: string, nextAlpha: number) => {
		setHex(nextHex);
		setAlpha(nextAlpha);
		const value = formatColor(nextHex, nextAlpha);
		setText(value);
		theme.set(token, value);
	};

	<>
		<style>
			.row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
			.preview { height: 48px; border-radius: 8px; border: 1px solid rgba(0, 0, 0, .25); background-image: linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, #fff 25%, #fff 75%, #ccc 75%); background-size: 14px 14px; background-position: 0 0, 7px 7px; margin-bottom: 10px; position: relative; overflow: hidden; }
			.preview div { position: absolute; inset: 0; }
			input[type=color] { width: 56px; height: 40px; padding: 0; background: none; border: none; flex: none; }
			input[type=range] { flex: 1; }
			input[type=text] { flex: 1; min-width: 0; }
			label { font-size: 13px; min-width: 76px; }
			.buttons { display: flex; justify-content: space-between; gap: 8px; margin-top: 4px; }
			.bad { outline: 2px solid #ff5a5a; }
		</style>
		<div class="preview"><div style={{ background: formatColor(hex(), alpha()) }}></div></div>
		<div class="row">
			<label>{"Цвет"}</label>
			<input type="color" value={hex()} onInput={(event) => apply(event.currentTarget.value, alpha())} />
			<input
				type="text" value={text()}
				onChange={(event) => {
					const parsed = parseColor(event.currentTarget.value);
					const ok = theme.set(token, event.currentTarget.value);
					event.currentTarget.classList.toggle("bad", !ok);
					if(ok && parsed) { setHex(parsed.hex); setAlpha(parsed.alpha); }
					setText(event.currentTarget.value);
				}}
			/>
		</div>
		<div class="row">
			<label>{"Прозрачность"}</label>
			<input type="range" min="0" max="100" value={Math.round(alpha() * 100)} onInput={(event) => apply(hex(), Number(event.currentTarget.value) / 100)} />
			<span>{Math.round(alpha() * 100) + "%"}</span>
		</div>
		<div class="buttons">
			<button onClick={() => { theme.reset(token); close(); }}>{"Сбросить"}</button>
			<button onClick={() => close()}>{"Готово"}</button>
		</div>
	</>
}
