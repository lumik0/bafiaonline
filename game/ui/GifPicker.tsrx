import { createSignal, fromEvents, onCleanup, onMount } from "@common/ui";
import { BAFIA_LIMITS, type GifItem } from "@common/bafia/protocol";
import { PREMIUM_BOT_URL } from "@common/constants";
import type { Bafia } from "../domain/bafia";

type Source = "giphy" | "bafia" | "mine";

const uploadErrors = {
	premium: "Загрузка своих гифок и стикеров доступна с премиумом: его можно купить в Telegram-боте за звёзды ⭐, код вводится в настройках игры.",
	offline: "Сервер Бафии сейчас недоступен.",
	"too-big": "Файл больше " + BAFIA_LIMITS.gifBytes / 1024 / 1024 + " МБ.",
	"bad-format": "Подходят GIF, WebP и PNG (не больше 2000×2000).",
	duplicate: "Такая гифка уже есть.",
	quota: "Слишком много загрузок: подожди, пока предыдущие проверят."
};

/**
 * выбор гифки: Giphy, каталог Бафии и «Мои» (свои загрузки, у премиума)
 * нажатие шлёт `[gif:номер]`; загрузка - только с премиумом, после проверки
 */
export function GifPicker({ bafia, pick }: { bafia: Bafia, pick: (id: string) => void }) @{
	const [source, setSource] = createSignal<Source>("giphy");
	const [items, setItems] = createSignal<GifItem[] | undefined>(undefined);
	const [loading, setLoading] = createSignal(true);
	// загрузка своей гифки: выбранный файл, название и ход дела
	const [file, setFile] = createSignal<File | undefined>(undefined);
	const [title, setTitle] = createSignal("");
	const [status, setStatus] = createSignal("");
	const [sending, setSending] = createSignal(false);
	const premium = fromEvents(bafia, "change", () => bafia.premiumUntil);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let latest = 0;
	let query = "";
	let chooser!: HTMLInputElement;

	const search = () => {
		const mine = ++latest;
		setLoading(true);
		void bafia.gifs(query.trim(), source()).then(found => {
			if(mine != latest) return;
			setItems(found);
			setLoading(false);
		});
	};
	const choose = (next: Source) => { setSource(next); setItems(undefined); setStatus(""); search(); };

	onMount(search);
	// связь с сервером могла ещё не установиться, когда панель открыли: повторяем, как только она появится
	const retry = bafia.on("change", () => { if(!items()) search(); });
	onCleanup(() => { clearTimeout(timer); retry.remove(); });

	const chosen = (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		const picked = input.files?.[0];
		input.value = "";
		if(!picked) return;
		if(picked.size > BAFIA_LIMITS.gifBytes) return setStatus(uploadErrors["too-big"]);
		if(!["image/gif", "image/webp", "image/png"].includes(picked.type)) return setStatus(uploadErrors["bad-format"]);
		setStatus("");
		setTitle(picked.name.replace(/\.[^.]+$/, "").slice(0, BAFIA_LIMITS.gifTitle));
		setFile(picked);
	};

	const send = async () => {
		const picked = file();
		if(!picked || sending()) return;
		setSending(true);
		const result = await bafia.uploadGif(title().trim(), new Uint8Array(await picked.arrayBuffer()));
		setSending(false);
		setStatus("ok" in result ? "Отправлено на проверку: после одобрения появится в каталоге Бафии, а пока видна во вкладке «Мои»." : uploadErrors[result.error]);
		if("ok" in result) setFile(undefined);
	};

	<>
		<style>
			.picker { display: flex; flex-direction: column; gap: 6px; padding: 0 10px 6px; color: var(--text-dark); }
			.picker input[type=text] { padding: 7px 10px; min-width: 0; }
			.tabs { display: flex; gap: 6px; align-items: center; }
			.tabs button { padding: 4px 12px; border-radius: 999px; font-size: 13px; opacity: .7; }
			.tabs button.on { opacity: 1; font-weight: 700; }
			.tabs .add { margin-left: auto; opacity: 1; }
			.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 6px; max-height: 190px; overflow-y: auto; }
			.grid img { width: 100%; height: 72px; object-fit: cover; border-radius: 6px; cursor: pointer; background: rgba(128, 128, 128, .25); }
			.credit { font-size: 11px; opacity: .7; text-align: right; }
			.credit a, .status a { color: inherit; }
			.empty, .status { font-size: 13px; opacity: .85; padding: 4px 2px; }
			.upload { display: flex; gap: 6px; }
			.upload input { flex: 1; }
		</style>
		<div class="picker">
			<div class="tabs">
				<button class={source() == "giphy" ? "on" : ""} onClick={() => choose("giphy")}>{"Giphy"}</button>
				<button class={source() == "bafia" ? "on" : ""} onClick={() => choose("bafia")}>{"Бафия"}</button>
				@if (premium()) {
					<button class={source() == "mine" ? "on" : ""} onClick={() => choose("mine")}>{"Мои"}</button>
				}
				@if (source() != "giphy") {
					<button class="add" onClick={() => premium() ? chooser.click() : setStatus(uploadErrors.premium)}>{"+ Добавить"}</button>
				}
				<input ref={chooser} type="file" accept="image/gif,image/webp,image/png" hidden onChange={chosen} />
			</div>
			@if (file()) {
				<div class="upload">
					<input type="text" placeholder="Название (по нему ищут)" maxlength="80" value={title()} onInput={(event) => setTitle(event.currentTarget.value)} />
					<button disabled={sending()} onClick={() => void send()}>{sending() ? "Отправка…" : "На проверку"}</button>
					<button disabled={sending()} onClick={() => setFile(undefined)}>{"Отмена"}</button>
				</div>
			}
			@if (status()) {
				<div class="status">
					{status()}
					@if (status() == uploadErrors.premium) {
						<>
							{" "}
							<a href={PREMIUM_BOT_URL} target="_blank" rel="noopener noreferrer">{"Открыть бота"}</a>
						</>
					}
				</div>
			}
			<input type="text" placeholder={source() == "giphy" ? "Поиск в Giphy" : source() == "bafia" ? "Поиск по гифкам Бафии" : "Поиск среди моих"} maxlength="40" onInput={(event) => { clearTimeout(timer); query = event.currentTarget.value; timer = setTimeout(search, 300); }} />
			@if (items() && items()!.length) {
				<>
					<div class="grid">
						@for (const gif of items()!) {
							<img src={gif.thumb ?? gif.url} alt={gif.title} title={gif.title + (gif.status == "pending" ? " (на проверке, отправить пока нельзя)" : "")} style={gif.status == "pending" ? { opacity: ".5" } : undefined} loading="lazy" referrerpolicy="no-referrer" onClick={() => { if(gif.status != "pending") pick(gif.id); }} />
						}
					</div>
					@if (source() == "giphy") {
						<div class="credit">
							<a href="https://giphy.com" target="_blank" rel="noopener noreferrer">{"Powered by GIPHY"}</a>
						</div>
					}
				</>
			} @else {
				<div class="empty">{loading() ? "Загрузка…" : items() ? (source() == "giphy" ? "Ничего не нашлось" : source() == "mine" ? "Ты ещё ничего не загружал: кнопка «+ Добавить»" : "Пока пусто") : source() == "giphy" ? "Поиск Giphy сейчас недоступен" : "Сервер Бафии сейчас недоступен"}</div>
			}
		</div>
	</>
}
