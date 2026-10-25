import { createSignal, fromEvents, onMount } from "@common/ui";
import { BAFIA_LIMITS, PREMIUM_COLORS } from "@common/bafia/protocol";
import { PREMIUM_BOT_URL } from "@common/constants";
import { BAFIA_CONSENT } from "../domain/bafia";
import { isMobile } from "@common/utils/mobile";
import { AppBar } from "../ui/AppBar.tsrx";
import { SettingRow } from "../ui/SettingRow.tsrx";
import { LanguageChoice } from "../ui/dialogs/LanguageChoice.tsrx";
import { LogsView } from "../ui/dialogs/LogsView.tsrx";
import type { GameContext } from "../context";

export function Settings({ ctx }: { ctx: GameContext }) @{
	const data = fromEvents(ctx.settings, "change", () => ({ ...ctx.settings.data, game: { ...ctx.settings.data.game }, window: { ...ctx.settings.data.window } }));
	// масштаб применяем при отпускании ползунка, чтобы он не уезжал из-под пальца
	const [pendingZoom, setPendingZoom] = createSignal<number | undefined>(undefined);
	const zoomRange = isMobile() ? { min: .5, max: 1.6 } : { min: .3, max: 1.5 };

	const flag = (key: "showYouDiedMessage" | "clearMessages" | "saveHistory", value: boolean) => ctx.settings.update(settings => { settings.game[key] = value; });

	// пол из профиля (в дашборде его нет)
	const [sex, setSex] = createSignal<number | undefined>(undefined);
	const [sexBusy, setSexBusy] = createSignal(false);
	onMount(() => void ctx.profile.mySex().then(setSex).catch(() => {}));
	const changeSex = async (next: number) => {
		if(sex() === next || sexBusy()) return;
		if(!await ctx.dialogs.confirm(next == 1 ? "Сменить пол на женский?" : "Сменить пол на мужской?", { title: "ПОЛ", yes: "Сменить" })) return;
		setSexBusy(true);
		try {
			const done = await ctx.profile.setSex(next);
			if(done) setSex(next);
			await ctx.dialogs.alert(done ? "Пол изменён." : "Сервер не принял смену пола: возможно, её можно менять не так часто. Попробуй позже.", { title: done ? "Готово" : "Не получилось" });
		} catch {
			await ctx.dialogs.alert("Сервер не ответил. Попробуй ещё раз.", { title: "Ошибка" });
		} finally {
			setSexBusy(false);
		}
	};

	const bafiaOn = fromEvents(ctx.settings, "change", () => ctx.settings.data.bafia.enabled);
	const premium = fromEvents(ctx.bafia, "change", () => ctx.bafia.premiumUntil);
	// цвет меняется в настройках игры, следим и за ним
	fromEvents(ctx.settings, "change", () => ctx.settings.data.bafia.color);
	const codeErrors = {
		invalid: "Такого кода нет. Проверь, что ввёл его без ошибок.",
		expired: "Срок этого кода закончился.",
		devices: "Код уже активирован на трёх устройствах. Попроси сбросить устройства или выдать новый код.",
		locked: "Слишком много неверных попыток. Попробуй через час.",
		offline: "Сервер Бафии сейчас недоступен."
	};
	/** что даёт премиум и где его купить (Telegram-бот, звёзды) */
	const buyPremium = async () => {
		const agreed = await ctx.dialogs.confirm(
			"Премиум даёт:\n" +
			"• загрузку своих гифок и стикеров: после проверки они появятся в каталоге Бафии у всех;\n" +
			"• цветной значок «Б» и рамку вокруг твоего ника у других игроков Бафии, цвет выбираешь сам;\n" +
			`• отправленные игры хранятся ${BAFIA_LIMITS.premiumHistoryDays} дней вместо ${BAFIA_LIMITS.historyDays}, их можно отправить больше и крупнее.\n\n` +
			"На саму игру премиум не влияет: у всех она одинаковая.\n\n" +
			"Оплата в Telegram-боте звёздами ⭐. Бот пришлёт код, его нужно ввести здесь же («Ввести код»).",
			{ title: "ПРЕМИУМ БАФИИ", yes: "Открыть бота", no: "Не сейчас" }
		);
		if(agreed) window.open(PREMIUM_BOT_URL, "_blank", "noopener");
	};

	/** код премиума от бота, запоминается для восстановления */
	const enterCode = async () => {
		const code = await ctx.dialogs.prompt({ title: "КОД ПРЕМИУМА", text: "Код присылает Telegram-бот после оплаты звёздами ⭐ (кнопка «Купить» в настройках). Премиум даёт загрузку своих гифок и стикеров, хранение отправленных игр до полугода, цветной значок с рамкой у твоего ника.", placeholder: "BAF-XXXX-XXXX-XXXX", initial: ctx.bafia.code, ok: "Активировать" });
		if(!code?.trim()) return;
		const result = await ctx.bafia.redeem(code);
		if("until" in result) await ctx.dialogs.alert(`Премиум действует до ${new Date(result.until).toLocaleDateString("ru-RU")}.\n\nСохрани код: ${code.trim().toUpperCase()}\nЕсли потеряешь данные браузера, введи его снова, и премиум вернётся.`, { title: "Готово" });
		else await ctx.dialogs.alert(codeErrors[result.error], { title: "Не получилось" });
	};

	/** отправка данных только с согласия */
	const toggleBafia = async (box: HTMLInputElement) => {
		if(!box.checked) return ctx.bafia.setEnabled(false);
		const agreed = await ctx.dialogs.confirm(BAFIA_CONSENT, { title: "СЕРВЕР БАФИИ", yes: "Согласен", no: "Не надо" });
		if(agreed) ctx.bafia.setEnabled(true);
		else box.checked = false;
	};

	<>
		<style>
			.page { display: flex; flex-direction: column; height: 100%; }
			.list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding: 10px; }
			input[type=checkbox] { zoom: 2.5; }
			.sexes { display: flex; gap: 6px; }
			.sex.on { background: var(--accent) !important; color: #fff; box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent); }
			.swatches { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; max-width: 150px; padding: 2px 0; }
			.swatch { width: 26px; height: 26px; padding: 0; border-radius: 50%; border: 2px solid transparent; }
			.swatch.on { border-color: var(--text); box-shadow: 0 0 0 2px var(--surface); }
			input[type=text] { width: 80px; }
		</style>
		<div class="page">
			<AppBar title="Настройки" onBack={() => ctx.nav.pop()} />
			<div class="list">
				<SettingRow label="Оформление"><button onClick={() => ctx.nav.push("theme")}>{"Настроить"}</button></SettingRow>
				<SettingRow label="Интерфейс с маленькой буквы">
					<input type="checkbox" checked={data().lowercase} onChange={(event) => ctx.settings.update(settings => { settings.lowercase = event.currentTarget.checked; })} />
				</SettingRow>
				<SettingRow label="Моды"><button onClick={() => ctx.nav.push("mods")}>{"Открыть"}</button></SettingRow>
				<SettingRow label="Пол">
					<div class="sexes">
						<button class={sex() === 0 ? "sex on" : "sex"} disabled={sexBusy()} onClick={() => void changeSex(0)}>{"♂ Мужской"}</button>
						<button class={sex() === 1 ? "sex on" : "sex"} disabled={sexBusy()} onClick={() => void changeSex(1)}>{"♀ Женский"}</button>
					</div>
				</SettingRow>
				<SettingRow label="Язык сервера">
					<button onClick={() => void ctx.dialogs.manager.open({ title: "ЯЗЫК СЕРВЕРА", render: (close) => LanguageChoice({ ctx, close }) })}>{"Выбрать"}</button>
				</SettingRow>
				<SettingRow label="Масштаб">
					<span>{(pendingZoom() ?? data().window.zoom).toFixed(1) + "×"}</span>
					<input
						type="range" min={zoomRange.min} max={zoomRange.max} step=".1" value={data().window.zoom}
						onInput={(event) => setPendingZoom(Number(event.currentTarget.value))}
						onChange={(event) => { setPendingZoom(undefined); ctx.settings.update(settings => { settings.window.zoom = Number(event.currentTarget.value); }); }}
					/>
				</SettingRow>
				<SettingRow label="Опьянение с">
					<input type="text" value={data().game.barmanEffect} onChange={(event) => ctx.settings.update(settings => { settings.game.barmanEffect = event.currentTarget.value; })} />
				</SettingRow>
				<SettingRow label={'Показывать сообщение «Ты умер»'}>
					<input type="checkbox" checked={data().game.showYouDiedMessage} onChange={(event) => flag("showYouDiedMessage", event.currentTarget.checked)} />
				</SettingRow>
				<SettingRow label="Удалять сообщения после начала игры">
					<input type="checkbox" checked={data().game.clearMessages} onChange={(event) => flag("clearMessages", event.currentTarget.checked)} />
				</SettingRow>
				<SettingRow label="Хранить историю после игры">
					<input type="checkbox" checked={data().game.saveHistory} onChange={(event) => flag("saveHistory", event.currentTarget.checked)} />
				</SettingRow>
				// <SettingRow label="Номера игроков за столом">
				// 	<input type="checkbox" checked={data().game.showIndexPl} onChange={(event) => ctx.settings.update(settings => { settings.game.showIndexPl = event.currentTarget.checked; })} />
				// </SettingRow>
				// <SettingRow label="Номера игроков в чате комнаты">
				// 	<input type="checkbox" checked={data().game.showIndexPlChat} onChange={(event) => ctx.settings.update(settings => { settings.game.showIndexPlChat = event.currentTarget.checked; })} />
				// </SettingRow>
				// <SettingRow label="Сервер Бафии">
				// 	<input type="checkbox" checked={bafiaOn()} onChange={(event) => void toggleBafia(event.currentTarget)} />
				// </SettingRow>
				@if (bafiaOn()) {
					<SettingRow label={premium() ? "Премиум до " + new Date(premium()!).toLocaleDateString("ru-RU") : "Премиум"}>
						<button onClick={() => void buyPremium()}>{premium() ? "Продлить" : "Купить"}</button>
						<button onClick={() => void enterCode()}>{"Ввести код"}</button>
					</SettingRow>
				}
				@if (bafiaOn() && premium()) {
					<SettingRow label="Цвет значка">
						<div class="swatches">
							@for (const [name, hex] of Object.entries(PREMIUM_COLORS)) {
								<button class={ctx.bafia.color == name ? "swatch on" : "swatch"} style={{ background: hex }} aria-label={name} onClick={() => ctx.bafia.setColor(name)}></button>
							}
						</div>
					</SettingRow>
				}
				<SettingRow label="Заявки в друзья во время игры (опыт)">
					<input type="checkbox" checked={data().game.pollRequests} onChange={(event) => ctx.settings.update(settings => { settings.game.pollRequests = event.currentTarget.checked; })} />
				</SettingRow>
				<SettingRow label="Скрывать никнейм везде">
					<input type="checkbox" checked={data().hideUsername} onChange={(event) => ctx.settings.update(settings => { settings.hideUsername = event.currentTarget.checked; })} />
				</SettingRow>
				<SettingRow label="Режим разработчика">
					<input type="checkbox" checked={data().developer} onChange={(event) => ctx.settings.update(settings => { settings.developer = event.currentTarget.checked; })} />
				</SettingRow>
				<SettingRow label="Логи">
					<button onClick={() => void ctx.dialogs.manager.open({ title: "ЛОГИ", wide: true, render: (close) => LogsView({ close }) })}>{"Получить"}</button>
				</SettingRow>
			</div>
		</div>
	</>
}
