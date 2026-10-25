import { createSignal, fromEvents, onMount } from "@common/ui";
import { formatDuration, formatNumber } from "@common/utils/format";
import { coinName, Market, type MarketView, type Offer, type ShopDecoration, type ShopItem, type SilverPack } from "../domain/market";
import { animationOf, argbToCss, decorationName, DecorationType, nickStyle, photoRing, type Decorations } from "../domain/decorations";
import { Avatar } from "../ui/Avatar.tsrx";
import { Lottie } from "../ui/Lottie.tsrx";
import { Amount } from "../ui/Amount.tsrx";
import { AppBar } from "../ui/AppBar.tsrx";
import type { GameContext } from "../context";

/** магазин: предметы и украшения за монеты, пополнение за деньги на сайте */
export function ShopScreen({ ctx }: { ctx: GameContext }) @{
	const market = new Market(ctx.client);
	const coins = fromEvents(ctx.user, "change", () => ({ gold: ctx.user.goldCoins, silver: ctx.user.silverCoins }));
	const [view, setView] = createSignal<MarketView | undefined>(undefined);
	const [failed, setFailed] = createSignal(false);
	const [busy, setBusy] = createSignal(false);
	/** чей магазин показан: пусто - свой, иначе ник другого игрока */
	const [forName, setForName] = createSignal("");
	const [nick, setNick] = createSignal("");
	/** выбранное предложение и вариант у каждого предмета */
	const [chosenOffer, setChosenOffer] = createSignal<Record<number, number>>({});
	const [chosenVariant, setChosenVariant] = createSignal<Record<string, number>>({});

	const load = async (name = forName()) => {
		setFailed(false);
		try {
			const loaded = await market.load(name || undefined);
			// монеты в ответе - те, что у владельца магазина; свои обновляем, только когда магазин свой
			if(!name) ctx.user.setCoins(loaded.gold, loaded.silver);
			setView(loaded);
			setForName(name);
		} catch {
			setFailed(true);
		}
	};
	onMount(() => void load(""));

	const offerOf = (item: ShopItem): Offer | undefined => item.offers.find(offer => offer.id == chosenOffer()[item.id]) ?? item.offers[0];

	const buy = async (item: ShopItem) => {
		const offer = offerOf(item);
		if(!offer || busy()) return;
		const label = (item.vip ? "VIP-аккаунт" : "Предмет") + (offer.seconds ? " на " + formatDuration(offer.seconds) : "");
		if(!await ctx.dialogs.confirm(`Купить ${label} за ${formatNumber(offer.price)} ${coinName[offer.coin]}?`, { title: "ПОКУПКА", yes: "Купить" })) return;

		setBusy(true);
		try {
			const params = Object.fromEntries(item.options.map(option => [option.type, chosenVariant()[item.id + ":" + option.type] ?? option.variants[0]?.id ?? 0]));
			const result = await market.buy(item, offer, params);
			if(result.status == "ok") ctx.user.setCoins(result.gold, result.silver);
			if(result.status == "full") await ctx.dialogs.alert("Рюкзак полон: предмет не поместился. Освободи место в рюкзаке и попробуй снова.", { title: "Покупка не удалась" });
			else await ctx.dialogs.alert((result.title ? result.title + ": куплено" : "Куплено") + ". Предмет лежит в рюкзаке.", { title: "Готово" });
			await load();
		} catch {
			await ctx.dialogs.alert("Сервер не ответил. Проверь рюкзак и монеты, прежде чем повторять покупку.", { title: "Ошибка" });
		} finally {
			setBusy(false);
		}
	};

	const decorationOffer = (decoration: ShopDecoration): Offer | undefined => decoration.offers.find(offer => offer.id == chosenOffer()[-decoration.id]) ?? decoration.offers[0];
	const variantOf = (decoration: ShopDecoration, option: ShopDecoration["options"][number]) =>
		option.variants.find(variant => variant.id == chosenVariant()[decoration.id + ":d:" + option.type]) ?? option.variants[0];
	/** варианты - готовые значения параметров (цвет, файл анимации) */
	const sample = (decoration: ShopDecoration): Decorations => ({
		[decoration.type]: Object.fromEntries(decoration.options.map(option => [option.type, variantOf(decoration, option)?.label ?? ""]))
	});
	/** почему анимация не загрузилась (адрес → причина) */
	const [animationErrors, setAnimationErrors] = createSignal<Record<number, string>>({});
	const failed_ = (decoration: ShopDecoration) => (reason: string) => setAnimationErrors({ ...animationErrors(), [decoration.id]: reason });
	const pickVariant = (decoration: ShopDecoration, option: ShopDecoration["options"][number], id: number) =>
		setChosenVariant({ ...chosenVariant(), [decoration.id + ":d:" + option.type]: id });
	const parameterName: Record<string, string> = { "0": "Прозрачность", "1": "Цвет", "2": "Анимация", "3": "Скорость" };
	/** подпись варианта: «gradient_1.json» → «gradient 1», числа - проценты */
	const variantText = (type: string, label: string) =>
		type == "2" ? label.replace(/\.json$/i, "").replaceAll("_", " ") : /^\d+$/.test(label) ? label + "%" : label;
	const nickPreview = (type: number) => type <= DecorationType.UsernameText;
	const swatch = (decoration: ShopDecoration) => {
		const params = sample(decoration)[decoration.type] ?? {};
		return argbToCss(params["1"]);
	};

	const buyDecoration = async (decoration: ShopDecoration) => {
		const offer = decorationOffer(decoration);
		if(!offer || busy()) return;
		const label = decorationName(decoration.type) + (offer.seconds ? " на " + formatDuration(offer.seconds) : "");
		if(!await ctx.dialogs.confirm(`Купить ${label} за ${formatNumber(offer.price)} ${coinName[offer.coin]}?`, { title: "ПОКУПКА", yes: "Купить" })) return;

		setBusy(true);
		try {
			const params = Object.fromEntries(decoration.options.map(option => [option.type, variantOf(decoration, option)?.id ?? 0]));
			const result = await market.buyDecoration(decoration, offer, params);
			if(result.status == "ok") ctx.user.setCoins(result.gold, result.silver);
			if(result.status == "full") await ctx.dialogs.alert("Рюкзак полон: украшение не поместилось. Освободи место в рюкзаке и попробуй снова.", { title: "Покупка не удалась" });
			else await ctx.dialogs.alert("Куплено. Украшение лежит в рюкзаке, надеть его можно там.", { title: "Готово" });
			await load();
		} catch {
			await ctx.dialogs.alert("Сервер не ответил. Проверь рюкзак и монеты, прежде чем повторять покупку.", { title: "Ошибка" });
		} finally {
			setBusy(false);
		}
	};

	/** пакет серебра за золото; ответа на пакет нет, итог видно по монетам */
	const buySilver = async (pack: SilverPack) => {
		if(busy()) return;
		if(!await ctx.dialogs.confirm(`Купить ${formatNumber(pack.coins)} серебра за ${formatNumber(pack.price)} золота?`, { title: "ПОКУПКА", yes: "Купить" })) return;

		setBusy(true);
		const before = ctx.user.silverCoins;
		try {
			const result = await market.buySilverPack(pack);
			if(result.status == "ok") ctx.user.setCoins(result.gold, result.silver);
			await load();
			const bought = result.status == "ok" || ctx.user.silverCoins > before;
			await ctx.dialogs.alert(bought ? "Куплено: серебро уже на счёте." : "Покупка не подтвердилась. Проверь монеты: если золота стало меньше, а серебра больше, всё прошло.", { title: bought ? "Готово" : "Проверь монеты" });
		} catch {
			await ctx.dialogs.alert("Сервер не ответил. Проверь монеты, прежде чем повторять покупку.", { title: "Ошибка" });
		} finally {
			setBusy(false);
		}
	};

	const pay = async (url: string) => {
		const target = forName() || view()?.username || "своего аккаунта";
		if(await ctx.dialogs.confirm(`Откроется страница оплаты на сайте для ${forName() ? "игрока «" + target + "»" : "твоего аккаунта"}. Оплата идёт там, в игре деньги не списываются.`, { title: "ОПЛАТА НА САЙТЕ", yes: "Открыть" })) window.open(url, "_blank", "noopener");
	};

	<>
		<style>
			.page { display: flex; flex-direction: column; height: 100%; }
			.coins { display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; background: var(--header-bg); color: var(--header-text); }
			.chips { display: flex; gap: 6px; }
			.chip { padding: 3px 10px; border-radius: 8px; background: rgba(255, 255, 255, .25); font-size: 14px; font-weight: 600; }
			.list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 10px; }
			.card { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: 10px; background: var(--surface); color: var(--text-dark); }
			.card h3 { margin: 0; font-size: 16px; font-weight: 500; }
			.card p { margin: 0; font-size: 13px; opacity: .85; }
			.row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
			.row select { flex: 1; min-width: 0; }
			.row button { flex: 1; }
			.section { margin: 6px 0 0; text-align: center; font-size: 15px; font-weight: 500; color: var(--text); }
			.who { display: flex; gap: 6px; }
			.who input { flex: 1; min-width: 0; padding: 7px 10px; }
			.note { font-size: 13px; opacity: .75; text-align: center; padding: 4px 8px; }
			.center { flex: 1; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 10px; opacity: .85; }
			.option { display: flex; flex-direction: column; gap: 4px; }
			.optname { font-size: 12px; opacity: .75; }
			.choices { display: flex; flex-wrap: wrap; gap: 6px; }
			.choice { min-height: 28px; min-width: 28px; padding: 2px 10px; border-radius: 14px; border: 2px solid transparent; background: rgba(128, 128, 128, .25); color: inherit; font-size: 13px; cursor: pointer; }
			.choice.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
			.preview { display: flex; align-items: center; justify-content: center; min-height: 52px; padding: 6px; border-radius: 8px; background: rgba(128, 128, 128, .15); }
			.preview .nick { position: relative; isolation: isolate; font-weight: 600; font-size: 16px; }
			.preview .box { position: relative; width: 100%; height: 52px; border-radius: 8px; }
			.for { text-align: center; font-size: 13px; padding: 4px 8px; border-radius: 8px; background: rgba(61, 214, 140, .3); }
		</style>
		<div class="page">
			<AppBar title="Магазин" onBack={() => ctx.nav.pop()} />
			@if (view()) {
				<>
					<div class="coins">
						<span>{"Твои монеты"}</span>
						<div class="chips">
							<span class="chip"><Amount value={formatNumber(coins().gold)} coin="gold" assets={ctx.assets} /></span>
							<span class="chip"><Amount value={formatNumber(coins().silver)} coin="silver" assets={ctx.assets} /></span>
						</div>
					</div>
					<div class="list">
						@for (const item of view()!.items) {
							<div class="card">
								<h3>{item.vip ? "👑 VIP аккаунт" : "Предмет"}</h3>
								@for (const option of item.options) {
									<div class="row">
										<span>{"Значок:"}</span>
										<select onChange={(event) => setChosenVariant({ ...chosenVariant(), [item.id + ":" + option.type]: Number(event.currentTarget.value) })}>
											@for (const variant of option.variants) {
												<option value={String(variant.id)}>{variant.label}</option>
											}
										</select>
									</div>
								}
								@if (item.offers.length) {
									<div class="row">
										<select onChange={(event) => setChosenOffer({ ...chosenOffer(), [item.id]: Number(event.currentTarget.value) })}>
											@for (const offer of item.offers) {
												<option value={String(offer.id)}>{offer.seconds ? formatDuration(offer.seconds) : "Навсегда"}</option>
											}
										</select>
										<button disabled={busy() || !offerOf(item)} onClick={() => void buy(item)}>{offerOf(item) ? <Amount value={formatNumber(offerOf(item)!.price)} coin={offerOf(item)!.coin} assets={ctx.assets} /> : "-"}</button>
									</div>
								}
							</div>
						}

						@if (view()!.decorations.length) {
							<div class="section">{"Украшения"}</div>
						}
						@for (const decoration of view()!.decorations) {
							<div class="card">
								<h3>{decorationName(decoration.type)}</h3>
								<div class="preview">
									@if (nickPreview(decoration.type)) {
										<span class="nick" style={nickStyle(sample(decoration))}>
											@if (animationOf(sample(decoration), decoration.type)) {
												<Lottie animation={() => animationOf(sample(decoration), decoration.type)} inset={nickPreview(decoration.type) ? "-15% -10%" : "0"} onError={failed_(decoration)} />
											}
											{ctx.user.username || "Ник"}
										</span>
									} @else {
										@if (decoration.type == DecorationType.PhotoBorder || decoration.type == DecorationType.PhotoBorderAnimation) {
											<Avatar photo={() => ctx.user.photo} assets={ctx.assets} size={44} ring={() => photoRing(sample(decoration))} animation={() => animationOf(sample(decoration), DecorationType.PhotoBorderAnimation)} />
										} @else {
											<div class="box" style={{ background: swatch(decoration) ?? "rgba(128,128,128,.3)" }}>
												@if (animationOf(sample(decoration), decoration.type)) {
													<Lottie animation={() => animationOf(sample(decoration), decoration.type)} inset={nickPreview(decoration.type) ? "-15% -10%" : "0"} onError={failed_(decoration)} />
												}
											</div>
										}
									}
								</div>
								@if (animationErrors()[decoration.id]) {
									<div class="note">{"Анимация не загрузилась: " + animationErrors()[decoration.id]}</div>
								}
								@for (const option of decoration.options) {
									@if (option.variants.length > 1) {
										<div class="option">
											<span class="optname">{parameterName[option.type] ?? "Вариант"}</span>
											<div class="choices">
												@for (const variant of option.variants) {
													<button class={variantOf(decoration, option)?.id == variant.id ? "choice on" : "choice"} title={variant.label} aria-label={variant.label} onClick={() => pickVariant(decoration, option, variant.id)} style={argbToCss(variant.label) ? { background: argbToCss(variant.label), width: "28px", padding: "0" } : undefined}>{argbToCss(variant.label) ? "" : variantText(option.type, variant.label)}</button>
												}
											</div>
										</div>
									}
								}
								@if (decoration.offers.length) {
									<div class="row">
										<select onChange={(event) => setChosenOffer({ ...chosenOffer(), [-decoration.id]: Number(event.currentTarget.value) })}>
											@for (const offer of decoration.offers) {
												<option value={String(offer.id)}>{offer.seconds ? formatDuration(offer.seconds) : "Навсегда"}</option>
											}
										</select>
										<button disabled={busy() || !decorationOffer(decoration)} onClick={() => void buyDecoration(decoration)}>{decorationOffer(decoration) ? <Amount value={formatNumber(decorationOffer(decoration)!.price)} coin={decorationOffer(decoration)!.coin} assets={ctx.assets} /> : "-"}</button>
									</div>
								}
							</div>
						}

						@if (!forName() && view()!.silverPacks.length) {
							<>
								<div class="section">{"Серебро за золото"}</div>
								@for (const pack of view()!.silverPacks) {
									<div class="card">
										<h3><Amount value={formatNumber(pack.coins)} coin="silver" assets={ctx.assets} after=" серебра" size={20} /></h3>
										<div class="row">
											<button disabled={busy() || coins().gold < pack.price} onClick={() => void buySilver(pack)}><Amount value={formatNumber(pack.price)} coin="gold" assets={ctx.assets} /></button>
										</div>
									</div>
								}
							</>
						}

						<div class="section">{"Пополнить за деньги на сайте"}</div>
						@if (forName()) {
							<div class="for">{"Магазин для игрока «" + forName() + "»"}</div>
						}
						@for (const offer of view()!.money) {
							<div class="card">
								<h3>{offer.title || offer.productId}</h3>
								@if (offer.description) {
									<p>{offer.description}</p>
								}
								<div class="row">
									<button disabled={!offer.url} onClick={() => offer.url && void pay(offer.url)}>{offer.url ? (offer.priceText || "Оплатить") + " - на сайте" : "Ссылки на оплату нет"}</button>
								</div>
							</div>
						} @empty {
							<div class="note">{"Предложений за деньги нет"}</div>
						}
						<div class="card">
							<h3>{"Купить для другого игрока"}</h3>
							<p>{"Введи ник: ссылки на оплату будут для его аккаунта."}</p>
							<div class="who">
								<input type="text" placeholder="Ник игрока" value={nick()} onInput={(event) => setNick(event.currentTarget.value)} onKeyDown={(event) => { if(event.key == "Enter" && nick().trim()) void load(nick().trim()); }} />
								<button disabled={!nick().trim()} onClick={() => void load(nick().trim())}>{"Показать"}</button>
								@if (forName()) {
									<button onClick={() => { setNick(""); void load(""); }}>{"Мой"}</button>
								}
							</div>
						</div>

					</div>
				</>
			} @else {
				<div class="center">
					@if (failed()) {
						<>
							<div>{forName() ? "Не удалось загрузить магазин игрока" : "Не удалось загрузить магазин"}</div>
							<button onClick={() => void load()}>{"Повторить"}</button>
						</>
					} @else {
						<div>{"Загрузка…"}</div>
					}
				</div>
			}
		</div>
	</>
}
