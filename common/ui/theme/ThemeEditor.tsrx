import { fromEvents } from "@common/ui";
import type { Dialogs } from "@common/ui/dialog/dialogs";
import { isMobile } from "@common/utils/mobile";
import { effects, tokenGroups, type ThemeManager, type TokenKey } from "@common/ui/theme";
import type { Assets } from "@common/assets";
import { ColorDialog } from "./ColorDialog.tsrx";
import { ImageSlots } from "./ImageSlots.tsrx";

function download(name: string, text: string) {
	const link = document.createElement("a");
	link.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
	link.download = name;
	link.click();
	URL.revokeObjectURL(link.href);
}

const FILL = "M16.56 8.94 7.62 0 6.21 1.41l2.38 2.38-5.15 5.15c-.59.59-.59 1.54 0 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12zM5.21 10 10 5.21 14.79 10H5.21zM19 11.5s-2 2.17-2 3.5c0 1.1.9 2 2 2s2-.9 2-2c0-1.33-2-3.5-2-3.5zM0 20h24v4H0z";
const TEXT = "M2 20h20v4H2v-4zm3.49-3h2.42l1.27-3.58h5.65L16.1 17h2.42L13.25 3h-2.5L5.49 17zm4.42-5.61 2.03-5.79h.12l2.03 5.79H9.91z";

type Pickers = { theme: ThemeManager, dialogs: Dialogs };

/** окно выбора цвета для одного токена */
const pickColor = ({ theme, dialogs }: Pickers, token: TokenKey, title: string) =>
	void dialogs.manager.open({ title: title.toUpperCase(), render: close => ColorDialog({ theme, token, close }) });

/** кнопка выбора цвета: ведро - фон, «A» - текст (как в официальном приложении) */
function PickButton({ pickers, token, title, kind }: { pickers: Pickers, token: TokenKey, title: string, kind: "fill" | "text" }) @{
	<>
		<style>
			.pick { width: 40px; height: 40px; padding: 0; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: var(--button-gray-bg); color: var(--button-gray-text); border: 1px solid rgba(0, 0, 0, .35); }
			.pick svg { width: 24px; height: 24px; fill: currentColor; }
		</style>
		<button class="pick" aria-label={title} title={title} onClick={() => pickColor(pickers, token, title)}>
			<svg viewBox="0 0 24 24"><path d={kind == "fill" ? FILL : TEXT} /></svg>
		</button>
	</>
}

/** карточка: название, образец цвета, кнопка выбора */
function SwatchCard({ pickers, token, title }: { pickers: Pickers, token: TokenKey, title: string }) @{
	<>
		<style>
			.card { padding: 8px 10px 10px; border-radius: 8px; background: var(--surface); }
			.card h4 { margin: 0 0 8px; text-align: center; font-size: 15px; font-weight: 500; color: var(--text); }
			.line { display: flex; align-items: center; gap: 8px; }
			.swatch { flex: 1; height: 44px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, .55); }
		</style>
		<div class="card">
			<h4>{title}</h4>
			<div class="line">
				<div class="swatch" style={{ background: "var(--" + token + ")" }}></div>
				<PickButton pickers={pickers} token={token} title={title} kind="fill" />
			</div>
		</div>
	</>
}

/** строка с образцом текста нужного цвета и кнопкой «A» */
function TextRow({ pickers, token, title, text }: { pickers: Pickers, token: TokenKey, title: string, text: string }) @{
	<>
		<style>
			.trow { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 8px; background: var(--surface); min-height: 44px; }
			.trow span { flex: 1; font-size: 15px; font-weight: 500; }
		</style>
		<div class="trow">
			<span style={{ color: "var(--" + token + ")" }}>{text}</span>
			<PickButton pickers={pickers} token={token} title={title} kind="text" />
		</div>
	</>
}

/** три кнопки приложения: красная, серая, зелёная; у каждой цвет фона и текста */
function ButtonsCard({ pickers }: { pickers: Pickers }) @{
	const kinds: { bg: TokenKey, text: TokenKey, title: string, class: string }[] = [
		{ bg: "button-bg", text: "button-text", title: "Кнопка", class: "red" },
		{ bg: "button-gray-bg", text: "button-gray-text", title: "Кнопка", class: "gray" },
		{ bg: "button-shop-bg", text: "button-shop-text", title: "Кнопка", class: "green" }
	];
	<>
		<style>
			.trio { display: flex; gap: 6px; }
			.one { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 8px 6px; border-radius: 8px; background: var(--surface); }
			.fake { width: 100%; padding: 8px 4px; text-align: center; font-size: 14px; border: 1px solid rgba(0, 0, 0, .45); border-radius: var(--button-radius); box-sizing: border-box; }
			.picks { display: flex; gap: 6px; }
		</style>
		<div class="trio">
			@for (const kind of kinds) {
				<div class="one">
					<div class="fake" style={{ background: "var(--" + kind.bg + ")", color: "var(--" + kind.text + ")" }}>{kind.title}</div>
					<div class="picks">
						<PickButton pickers={pickers} token={kind.bg} title={"Фон кнопки"} kind="fill" />
						<PickButton pickers={pickers} token={kind.text} title={"Текст кнопки"} kind="text" />
					</div>
				</div>
			}
		</div>
	</>
}

/** карточка с примером (элемент списка, сообщение) и кнопкой выбора цвета фона */
function PreviewCard({ pickers, token, title, children }: { pickers: Pickers, token: TokenKey, title: string, children?: unknown }) @{
	<>
		<style>
			.pcard { padding: 8px 10px 10px; border-radius: 8px; background: var(--surface); }
			.pcard h4 { margin: 0 0 8px; text-align: center; font-size: 15px; font-weight: 500; color: var(--text); }
			.pline { display: flex; align-items: center; gap: 8px; }
			.sample { flex: 1; min-width: 0; border-radius: 8px; padding: 6px 8px; }
		</style>
		<div class="pcard">
			<h4>{title}</h4>
			<div class="pline">
				<div class="sample" style={{ background: "var(--" + token + ")" }}>{children}</div>
				<PickButton pickers={pickers} token={token} title={title} kind="fill" />
			</div>
		</div>
	</>
}

/** меняет цвета и картинки оформления; сохраняется само */
export function ThemeEditor({ theme, assets, dialogs }: { theme: ThemeManager, assets?: Assets, dialogs: Dialogs }) @{
	const values = fromEvents(theme, "change", () => ({ ...theme.values }));
	const overridden = fromEvents(theme, "change", () => new Set(Object.keys(theme.overrides)));
	const active = fromEvents(theme, "change", () => theme.active);
	const themes = fromEvents(theme, "change", () => theme.themes);
	const effect = fromEvents(theme, "change", () => theme.effect);
	const builtIn = () => themes().find(item => item.id == active())?.builtIn ?? true;
	const activeName = () => themes().find(item => item.id == active())?.name ?? "";

	const create = async () => {
		const name = await dialogs.prompt({ title: "НОВАЯ ТЕМА", text: "Новая тема начинается как «Классика»", ok: "Создать", placeholder: "Название" });
		if(name?.trim()) theme.create(name);
	};

	const rename = async () => {
		const name = await dialogs.prompt({ title: "НАЗВАНИЕ ТЕМЫ", ok: "Сохранить", placeholder: "Название", initial: activeName() });
		if(name?.trim()) theme.rename(active(), name);
	};

	const remove = async () => {
		if(await dialogs.confirm(`Удалить тему «${activeName()}»?`, { yes: "Удалить" })) theme.remove(active());
	};

	// окна и док есть только в оформлении рабочего стола: на телефоне их нет
	const groups = tokenGroups.filter(group => !(isMobile() && group.id == "windows"));

	const edit = (key: TokenKey, event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		// некорректное значение не применяется, поле подсвечивается
		input.classList.toggle("invalid", !theme.set(key, input.value));
	};

	const pickFile = () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "application/json";
		input.onchange = async () => {
			const file = input.files?.[0];
			if(!file) return;
			try {
				theme.importJson(await file.text());
			} catch(error) {
				void dialogs.alert(error instanceof Error ? error.message : String(error));
			}
		};
		input.click();
	};

	const pickers: Pickers = { theme, dialogs };

	<>
		<style>
			.editor { display: flex; flex-direction: column; gap: 12px; padding: 12px; color: var(--text); }
			.themes { padding: 8px 10px; border-radius: 8px; background: var(--surface); display: flex; flex-direction: column; gap: 8px; }
			.bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
			.heading { text-align: center; font-size: 17px; font-weight: 500; margin: 4px 0 0; color: var(--text); }
			.reset { width: 100%; padding: 10px; font-size: 15px; }
			.sample-name { display: flex; align-items: center; gap: 8px; color: var(--text-dark); font-size: 15px; }
			.sample-name i { width: 28px; height: 28px; border-radius: 50%; background: #111; border: 2px solid #d03a41; flex: none; }
			.sample-message { color: var(--chat-text); font-size: 14px; }
			.time { display: block; text-align: right; font-size: 10px; opacity: .6; }
			h3 { margin: 0 0 6px; font-size: 14px; opacity: .8; }
			details { padding: 8px 10px; border-radius: 8px; background: var(--surface); }
			summary { cursor: pointer; font-size: 14px; font-weight: 500; }
			.row { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
			.row label { flex: 1; font-size: 13px; }
			.row input[type=text] { width: 150px; }
			.row input[type=color] { width: 32px; height: 26px; padding: 0; background: none; }
			.row input.invalid { outline: 2px solid #ff5a5a; }
			.mark { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
			.row button { padding: 2px 8px; font-size: 12px; }
		</style>
		<div class="editor">
			<div class="themes">
				<div class="bar">
					<select onChange={(event) => theme.select(event.currentTarget.value)}>
						@for (const item of themes()) {
							<option value={item.id} selected={active() == item.id}>{item.name}</option>
						}
					</select>
					<button onClick={() => void create()}>{"Новая"}</button>
					<button disabled={builtIn()} onClick={() => void rename()}>{"Переименовать"}</button>
					<button disabled={builtIn()} onClick={() => void remove()}>{"Удалить"}</button>
				</div>
				<div class="bar">
					<label>{"Эффект: "}
						<select onChange={(event) => theme.setEffect(event.currentTarget.value)}>
							@for (const item of effects) {
								<option value={item.id} selected={effect() == item.id}>{item.label}</option>
							}
						</select>
					</label>
					<button onClick={() => download("bafia-theme.json", theme.exportJson())}>{"Экспорт"}</button>
					<button onClick={pickFile}>{"Импорт"}</button>
				</div>
			</div>

			<div class="heading">{"Настрой цвета приложения"}</div>
			<button class="reset" onClick={() => theme.resetAll()}>{"Сбросить"}</button>

			@if (assets) {
				<ImageSlots assets={assets} dialogs={dialogs} />
			}

			<SwatchCard pickers={pickers} token="bg" title="Основной фон" />
			<SwatchCard pickers={pickers} token="accent" title="Основной цвет" />
			<SwatchCard pickers={pickers} token="dialog-bg" title="Фон диалогового окна" />
			<ButtonsCard pickers={pickers} />
			<PreviewCard pickers={pickers} token="surface" title="Элементы в списках">
				<div class="sample-name"><i></i><span>{"Никнэйм 👑"}</span></div>
			</PreviewCard>
			<PreviewCard pickers={pickers} token="chat-panel" title="Фон обычного сообщения">
				<div class="sample-name"><i></i><span>{"Никнэйм 👑"}</span></div>
				<div class="sample-message">{"Текст обычного сообщения"}</div>
				<span class="time">{"01.01.1970 07:00"}</span>
			</PreviewCard>
			<TextRow pickers={pickers} token="text-dark" title="Основной текст" text="Основной текст" />
			<TextRow pickers={pickers} token="text" title="Контрастный текст" text="Контрастный текст" />
			<TextRow pickers={pickers} token="chat-system" title="Второстепенный текст" text="Второстепенный текст" />
			<TextRow pickers={pickers} token="chat-join" title="Игрок вошёл" text="Игрок Никнэйм вошёл" />
			<TextRow pickers={pickers} token="chat-leave" title="Игрок вышел" text="Игрок Никнэйм вышел" />
			<TextRow pickers={pickers} token="chat-vote" title="Регистрация" text="Регистрация" />
			<TextRow pickers={pickers} token="chat-danger" title="Игра началась" text="Игра началась" />
			<TextRow pickers={pickers} token="chat-day" title="Все остались живы" text="ВСЕ остались живы. Никого не удалось убить!" />
			<TextRow pickers={pickers} token="chat-info" title="Выбор жертвы" text="[МАФИЯ выбирает жертву]" />
			<TextRow pickers={pickers} token="chat-text" title="Обычное сообщение" text="Текст обычного сообщения" />
			<TextRow pickers={pickers} token="chat-dead" title="Последнее слово" text="Текст последнего слова" />
			<TextRow pickers={pickers} token="chat-night" title="Сообщение убитого игрока" text="Текст сообщения убитого игрока" />

			<details>
				<summary>{"Все цвета по отдельности"}</summary>
				@for (const group of groups) {
					<section>
						<h3>{group.label}</h3>
						@for (const token of group.tokens) {
							<div class="row">
								<span class="mark" style={{ visibility: overridden().has(token.key) ? "visible" : "hidden" }}></span>
								<label>{token.label}</label>
								@if (token.kind == "color" && /^#[0-9a-f]{6}$/i.test(values()[token.key])) {
									<input type="color" value={values()[token.key]} onInput={(event) => edit(token.key, event)} />
								}
								<input type="text" value={values()[token.key]} onChange={(event) => edit(token.key, event)} />
								<button disabled={!overridden().has(token.key)} onClick={() => theme.reset(token.key)}>{"↺"}</button>
							</div>
						}
					</section>
				}
			</details>
		</div>
	</>
}
