import { createSignal, fromEvents, onCleanup, onMount } from "@common/ui";
import { BAFIA_LIMITS, PREMIUM_COLORS, PROFILE_EFFECTS, PROFILE_THEMES, type ProfileEffect, type ProfileLook, type ProfileTheme } from "@common/bafia/protocol";
import { avatarFrame, nickEffect, themeBackground } from "../domain/premium-style";
import { PREMIUM_BOT_URL } from "@common/constants";
import { BAFIA_CONSENT } from "../domain/bafia";
import { formatDateTime } from "@common/utils/format";
import { isMobile } from "@common/utils/mobile";
import { isAppMode } from "@common/utils/native";
import { version } from "@common/version";
import { readableOn } from "../domain/decorations";
import { Avatar } from "../ui/Avatar.tsrx";
import { AppBar } from "../ui/AppBar.tsrx";
import { resetTips } from "../domain/tips";
import { SettingGroup, SettingRow, Toggle } from "../ui/SettingRow.tsrx";
import { PinPicker } from "../ui/dialogs/PinPicker.tsrx";
import { LanguageChoice } from "../ui/dialogs/LanguageChoice.tsrx";
import { LogsView } from "../ui/dialogs/LogsView.tsrx";
import { resetPassword } from "../ui/reset-password";
import type { GameContext } from "../context";

export function Settings({ ctx }: { ctx: GameContext }) @{
	const data = fromEvents(ctx.settings, "change", () => ({ ...ctx.settings.data, game: { ...ctx.settings.data.game }, window: { ...ctx.settings.data.window } }));
	// масштаб применяем при отпускании ползунка, чтобы он не уезжал из-под пальца
	const [pendingZoom, setPendingZoom] = createSignal<number | undefined>(undefined);
	const zoomRange = isMobile() ? { min: .5, max: 1.6 } : { min: .3, max: 1.5 };

	const flag = (key: "showYouDiedMessage" | "clearMessages" | "saveHistory" | "skyAnimation" | "animateChatAvatars", value: boolean) => ctx.settings.update(settings => { settings.game[key] = value; });

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

	const registered = fromEvents(ctx.user, "change", () => ctx.user.created);

	const bafiaOn = fromEvents(ctx.settings, "change", () => ctx.settings.data.bafia.enabled);
	const premium = fromEvents(ctx.bafia, "change", () => ctx.bafia.premiumUntil);
	// статус премиума цветом: серый - не активирован, зелёный - действует, красный - закончился (код сохранён, а сервер премиум уже не видит)
	const premiumState = fromEvents(ctx.bafia, "change", () => ctx.bafia.premiumUntil ? "active" : ctx.bafia.code && ctx.bafia.ready ? "expired" : "none");
	const premiumStates = { none: ["#9aa0a6", "Не активирован"], active: ["#2fb44c", "Активирован"], expired: ["#d94452", "Закончился"] } as const;
	// связь с сервером Бафии: от неё зависят значки, гифки и статистика; на скриншоте видно, подключено ли у игрока
	const bafiaStatus = fromEvents(ctx.bafia, "change", () => ctx.bafia.status);
	const problems: Record<string, string> = { version: "версия игры устарела, обнови страницу", "too-many": "открыто слишком много окон", "no-answer": "сервер не ответил", "slow-down": "слишком часто", unreachable: "сервер не открывается с этого устройства (сеть, DNS или сертификат)", "ws-blocked": "сервер доступен, но соединение игры не проходит" };
	const statusText = () => {
		const status = bafiaStatus();
		if(status.state == "connected") return "подключено";
		if(status.state == "connecting") return "подключаюсь…";
		const attempts = status.attempts ? ` (попыток: ${status.attempts})` : "";
		return "нет связи" + attempts + (status.problem ? ": " + (problems[status.problem] ?? status.problem) : "");
	};
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
			"• цветную галочку и рамку вокруг твоего ника у других игроков Бафии, цвет выбираешь сам;\n" +
			`• отправленные игры хранятся ${BAFIA_LIMITS.premiumHistoryDays} дней вместо ${BAFIA_LIMITS.historyDays}, их можно отправить больше и крупнее.\n\n` +
			"На саму игру премиум не влияет: у всех она одинаковая.\n\n" +
			"Оплата в Telegram-боте звёздами ⭐. Бот пришлёт код, его нужно ввести здесь же («Ввести код»).",
			{ title: "ПРЕМИУМ БАФИИ", yes: "Открыть бота", no: "Не сейчас" }
		);
		if(agreed) window.open(PREMIUM_BOT_URL, "_blank", "noopener");
	};

	// привязка Telegram (необязательная): ссылка в бота, подтверждение приходит от сервера само
	const [tgLinked, setTgLinked] = createSignal<boolean | undefined>(undefined);
	onMount(() => {
		void ctx.bafia.tgLink().then(state => setTgLinked(state?.linked));
		const stop = ctx.bafia.watchTgLink(async nick => {
			setTgLinked(true);
			await ctx.dialogs.alert(nick ? `Telegram привязан. Раньше он играл как «${nick}».` : "Telegram привязан.", { title: "TELEGRAM" });
		});
		onCleanup(stop);
	});
	const linkTelegram = async () => {
		const state = await ctx.bafia.tgLink();
		if(!state) return void await ctx.dialogs.alert("Сервер Бафии сейчас недоступен.", { title: "TELEGRAM" });
		if(state.linked) return void setTgLinked(true);
		if(!state.url) return void await ctx.dialogs.alert("Привязка сейчас недоступна.", { title: "TELEGRAM" });
		window.open(state.url, "_blank", "noopener");
	};
	const unlinkTelegram = async () => {
		if(!await ctx.dialogs.confirm("Отвязать Telegram от этой установки?", { yes: "Отвязать" })) return;
		if(await ctx.bafia.tgUnlink()) setTgLinked(false);
	};

	/** код премиума от бота, запоминается для восстановления */
	const enterCode = async () => {
		const code = await ctx.dialogs.prompt({ title: "КОД ПРЕМИУМА", text: "Код присылает Telegram-бот после оплаты звёздами ⭐ (кнопка «Купить» в настройках). Премиум даёт цветную галочку с рамкой у твоего ника и хранение отправленных игр до полугода.", placeholder: "BAF-XXXX-XXXX-XXXX", initial: ctx.bafia.code, ok: "Активировать" });
		if(!code?.trim()) return;
		const result = await ctx.bafia.redeem(code);
		if("until" in result) await ctx.dialogs.alert(`Премиум действует до ${new Date(result.until).toLocaleDateString("ru-RU")}.\n\nСохрани код: ${code.trim().toUpperCase()}\nЕсли потеряешь данные браузера, введи его снова, и премиум вернётся.`, { title: "Готово" });
		else await ctx.dialogs.alert(codeErrors[result.error], { title: "Не получилось" });
	};

	let avatarChooser!: HTMLInputElement;
	const myAvatar = fromEvents(ctx.bafia, "change", () => ctx.bafia.myAvatarUrl);
	const avatarErrors = {
		offline: "Сервер Бафии сейчас недоступен.",
		premium: "GIF-аватарка доступна только с премиумом.",
		"too-big": "Файл больше 16 МБ. Выбери поменьше.",
		"bad-format": "Нужен GIF, WebP или PNG.",
		quota: "Слишком часто меняешь аватарку. Попробуй завтра.",
		full: "На сервере Бафии сейчас нет места под загрузки. Попробуй позже.",
		"presence-first": "Сервер Бафии ещё не узнал тебя: подожди пару секунд и повтори."
	};
	// загрузка идёт по сети и может занять время: кнопка сразу показывает "Загрузка" и полоску
	const [avatarBusy, setAvatarBusy] = createSignal(false);
	const [bannerBusy, setBannerBusy] = createSignal(false);
	/** выбранный файл уходит на сервер как есть: анимация сохраняется, её видят другие игроки Бафии */
	const pickAvatar = async (input: HTMLInputElement) => {
		const file = input.files?.[0];
		input.value = "";
		if(!file) return;
		setAvatarBusy(true);
		try {
			const result = await ctx.bafia.setAvatar(new Uint8Array(await file.arrayBuffer()));
			if("error" in result) await ctx.dialogs.alert(avatarErrors[result.error], { title: "Не получилось" });
		} finally {
			setAvatarBusy(false);
		}
	};
	const removeAvatar = async () => {
		if(!await ctx.bafia.clearAvatar()) await ctx.dialogs.alert(avatarErrors.offline, { title: "Не получилось" });
	};

	// кастом профиль (премиум): баннер и цвет фона, пример профиля обновляется сразу
	let bannerChooser!: HTMLInputElement;
	const myBanner = fromEvents(ctx.bafia, "change", () => ctx.bafia.myBannerUrl);
	const myBg = fromEvents(ctx.bafia, "change", () => ctx.bafia.myProfileBg);
	const [draftBg, setDraftBg] = createSignal<string | undefined>(undefined);
	const myLook = fromEvents(ctx.bafia, "change", () => ctx.bafia.myLook);
	const [draftStatus, setDraftStatus] = createSignal<string | undefined>(undefined);
	const lookNow = (): ProfileLook => ({ ...myLook(), ...(draftStatus() !== undefined ? { status: draftStatus() || undefined } : {}) });
	const badgeColor = () => PREMIUM_COLORS[(ctx.bafia.color in PREMIUM_COLORS ? ctx.bafia.color : "gold") as keyof typeof PREMIUM_COLORS];
	const previewTheme = () => themeBackground(lookNow());
	const previewBg = () => previewTheme()?.background ?? draftBg() ?? myBg();
	/** меняет одно поле внешнего вида и отправляет всё на сервер; пустое значение убирает поле */
	const changeLook = async (change: Partial<Record<keyof ProfileLook, string | undefined>>) => {
		const next = { ...myLook(), ...change } as Record<string, string | undefined>;
		for(const key of Object.keys(next)) if(!next[key]) delete next[key];
		const result = await ctx.bafia.setLook(next as ProfileLook);
		setDraftStatus(undefined);
		if(result != "ok") await ctx.dialogs.alert(result == "premium" ? "Это доступно только с премиумом." : avatarErrors.offline, { title: "Не получилось" });
	};
	const effectNames: Record<ProfileEffect, string> = { gradient: "Градиент", rainbow: "Радуга" };
	const themeNames: Record<ProfileTheme, string> = { sunset: "Закат", ocean: "Океан", forest: "Лес", night: "Ночь", candy: "Конфета", violet: "Фиолет", peach: "Персик", mint: "Мята", gold: "Золото", fire: "Огонь", aurora: "Аврора", cherry: "Вишня" };
	const bannerErrors = { ...avatarErrors, premium: "Баннер доступен только с премиумом.", quota: "Слишком часто меняешь баннер. Попробуй завтра." };
	const pickBanner = async (input: HTMLInputElement) => {
		const file = input.files?.[0];
		input.value = "";
		if(!file) return;
		setBannerBusy(true);
		try {
			const result = await ctx.bafia.setBanner(new Uint8Array(await file.arrayBuffer()));
			if("error" in result) await ctx.dialogs.alert(bannerErrors[result.error], { title: "Не получилось" });
		} finally {
			setBannerBusy(false);
		}
	};
	const removeBanner = async () => {
		if(!await ctx.bafia.clearBanner()) await ctx.dialogs.alert(avatarErrors.offline, { title: "Не получилось" });
	};
	const saveBg = async (color: string) => {
		const result = await ctx.bafia.setProfileBg(color);
		setDraftBg(undefined);
		if(result != "ok") await ctx.dialogs.alert(result == "premium" ? "Цвет фона доступен только с премиумом." : avatarErrors.offline, { title: "Не получилось" });
	};

	/** отправка данных только с согласия */
	const toggleBafia = async (value: boolean, input: HTMLInputElement) => {
		if(!value) return ctx.bafia.setEnabled(false);
		const agreed = await ctx.dialogs.confirm(BAFIA_CONSENT, { title: "СЕРВЕР БАФИИ", yes: "Согласен", no: "Не надо" });
		if(agreed) ctx.bafia.setEnabled(true);
		else input.checked = false;
	};

	// вкладки: настройки сгруппированы по смыслу, а не одним длинным списком
	const TABS = [["main", "Основное"], ["game", "Игра"], ["account", "Аккаунт"], ["bafia", "Бафия"], ["more", "Ещё"]] as const;
	const [tab, setTab] = createSignal<string>("main");
	const set = (change: (settings: typeof ctx.settings.data) => void) => ctx.settings.update(change);

	<>
		<style>
			.page { display: flex; flex-direction: column; height: 100%; }
			.tabs { flex: none; display: flex; gap: 6px; padding: 8px 10px 2px; overflow-x: auto; scrollbar-width: none; }
			.tabs::-webkit-scrollbar { display: none; }
			.tab { flex: none; padding: 7px 15px; border: none; border-radius: 999px; background: var(--surface); color: var(--text-dark); font-size: 14px; }
			.tab.on { background: var(--accent); color: #fff; font-weight: 700; }
			.body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding: 10px; }
			.sexes { display: flex; gap: 6px; }
			.sex.on { background: var(--accent) !important; color: #fff; box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent); }
			.swatches { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; max-width: 230px; padding: 2px 0; }
			.swatch { width: 26px; height: 26px; padding: 0; border-radius: 50%; border: 2px solid transparent; }
			.swatch.on { border-color: var(--text); box-shadow: 0 0 0 2px var(--surface); }
			input[type=text] { width: 80px; }
			.preview { border-radius: 12px; overflow: hidden; background: var(--surface); color: var(--text-dark); }
			.previewBanner { height: 110px; background-color: rgba(128, 128, 128, .25); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; font-size: 12px; opacity: .9; }
			.previewBody { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 0 12px 12px; }
			.previewBody .photo { margin-top: -36px; border-radius: 50%; box-shadow: 0 0 0 3px rgba(255, 255, 255, .85); }
			.previewName { font-size: 16px; font-weight: 700; }
			.previewStat { width: 100%; display: flex; justify-content: space-between; padding: 6px 10px; border-radius: 6px; background: rgba(128, 128, 128, .18); font-size: 13px; box-sizing: border-box; }
			.previewStatus { font-size: 13px; opacity: .9; text-align: center; overflow-wrap: anywhere; }
			.progress { height: 6px; margin: 0 2px 6px; border-radius: 3px; background: rgba(128, 128, 128, .25); overflow: hidden; }
			.progress div { width: 40%; height: 100%; border-radius: 3px; background: var(--accent); animation: slide 1.1s ease-in-out infinite; }
			@keyframes slide { 0% { margin-left: -40%; } 100% { margin-left: 100%; } }
			.pstate { flex: none; width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 0 2px var(--surface); }
			.pick { padding: 5px 10px; font-size: 13px; }
			.pick.on { background: var(--accent) !important; color: #fff; }
			select { max-width: 150px; }
			input[type=color] { width: 40px; height: 30px; padding: 0; border: none; background: none; }
			.avatarPreview { border-radius: 50%; object-fit: cover; }
			.bafiaState { font-size: 13px; text-align: right; }
			.zoom { display: flex; align-items: center; gap: 8px; }
			.value { font-size: 14px; opacity: .8; }
		</style>
		<div class="page">
			<AppBar title="Настройки" onBack={() => ctx.nav.pop()} />
			<div class="tabs" role="tablist">
				@for (const [id, title] of TABS) {
					<button role="tab" class={tab() == id ? "tab on" : "tab"} aria-selected={tab() == id} onClick={() => setTab(id)}>{title}</button>
				}
			</div>
			<div class="body">
				@if (tab() == "main") {
					<>
						<SettingGroup title="ВНЕШНИЙ ВИД">
							<SettingRow label="Оформление" hint="Темы, цвета, обои"><button onClick={() => ctx.nav.push("theme")}>{"Настроить"}</button></SettingRow>
							<SettingRow label="Масштаб">
								<div class="zoom">
									<span class="value">{(pendingZoom() ?? data().window.zoom).toFixed(1) + "×"}</span>
									<input
										type="range" min={zoomRange.min} max={zoomRange.max} step=".1" value={data().window.zoom}
										onInput={(event) => setPendingZoom(Number(event.currentTarget.value))}
										onChange={(event) => { setPendingZoom(undefined); set(settings => { settings.window.zoom = Number(event.currentTarget.value); }); }}
									/>
								</div>
							</SettingRow>
							<SettingRow label="Интерфейс с маленькой буквы">
								<Toggle label="Интерфейс с маленькой буквы" checked={data().lowercase} onChange={(value) => set(settings => { settings.lowercase = value; })} />
							</SettingRow>
							<SettingRow label="Анимация переходов" hint="Плавное открытие экранов">
								<Toggle label="Анимация переходов между экранами" checked={data().navAnimation} onChange={(value) => set(settings => { settings.navAnimation = value; })} />
							</SettingRow>
						</SettingGroup>
						<SettingGroup title="СЛАБЫЙ ТЕЛЕФОН">
							<SettingRow label="Экономия ресурсов" hint="Без анимаций ников и рамок, праздничных эффектов и переходов: меньше нагрузка, если игра лагает">
								<Toggle label="Экономия ресурсов" checked={data().lowPower} onChange={(value) => set(settings => { settings.lowPower = value; })} />
							</SettingRow>
						</SettingGroup>
						<SettingGroup title="ПРИВАТНОСТЬ И ЯЗЫК">
							<SettingRow label="Подсказки в игре" hint="Короткие советы, когда они пригодятся; выполненные больше не появляются">
								<Toggle label="Подсказки в игре" checked={data().tips.enabled} onChange={(value) => set(settings => { settings.tips.enabled = value; })} />
							</SettingRow>
							<SettingRow label="Показать подсказки заново"><button onClick={() => { resetTips(ctx.settings); ctx.host.notifications.show({ title: "Подсказки", kind: "success", text: "Выполненные подсказки снова будут появляться." }); }}>{"Сбросить"}</button></SettingRow>
							<SettingRow label="Скрывать никнейм везде" hint="Твой ник размывается на экране, удобно для записи и скриншотов">
								<Toggle label="Скрывать никнейм везде" checked={data().hideUsername} onChange={(value) => set(settings => { settings.hideUsername = value; })} />
							</SettingRow>
							<SettingRow label="Язык сервера">
								<button onClick={() => void ctx.dialogs.manager.open({ title: "ЯЗЫК СЕРВЕРА", render: (close) => LanguageChoice({ ctx, close }) })}>{"Выбрать"}</button>
							</SettingRow>
						</SettingGroup>
					</>
				}
				@if (tab() == "game") {
					<>
						<SettingGroup title="ВО ВРЕМЯ ИГРЫ">
							<SettingRow label="Опьянение с" hint="Знак в начале сообщения: дальше текст «пьяный» (для бармена)">
								<input type="text" value={data().game.barmanEffect} onChange={(event) => set(settings => { settings.game.barmanEffect = event.currentTarget.value; })} />
							</SettingRow>
							<SettingRow label={'Сообщение «Ты умер»'} hint="Показывать, когда тебя убили">
								<Toggle label="Показывать сообщение Ты умер" checked={data().game.showYouDiedMessage} onChange={(value) => flag("showYouDiedMessage", value)} />
							</SettingRow>
							<SettingRow label="Очищать чат при старте игры" hint="Сообщения регистрации пропадают, когда игра началась">
								<Toggle label="Удалять сообщения после начала игры" checked={data().game.clearMessages} onChange={(value) => flag("clearMessages", value)} />
							</SettingRow>
							<SettingRow label="Солнце и луна" hint="Днём солнце, ночью луна в панели с таймером">
								<Toggle label="Солнце и луна в панели игры" checked={data().game.skyAnimation !== false} onChange={(value) => flag("skyAnimation", value)} />
							</SettingRow>
							<SettingRow label="GIF-аватарки в чате" hint="Анимация аватарок в чате и списках; на слабом телефоне может лагать">
								<Toggle label="Играть GIF-аватарки в чате" checked={data().game.animateChatAvatars === true} onChange={(value) => flag("animateChatAvatars", value)} />
							</SettingRow>
						</SettingGroup>
						<SettingGroup title="ИСТОРИЯ">
							<SettingRow label="Хранить историю игр" hint="Игры можно пересмотреть и отправить другу">
								<Toggle label="Хранить историю после игры" checked={data().game.saveHistory} onChange={(value) => flag("saveHistory", value)} />
							</SettingRow>
						</SettingGroup>
						<SettingGroup title="ОПЫТЫ">
							<SettingRow label="Заявки в друзья в игре" hint="Проверять заявки, даже когда ты не в меню (экспериментально)">
								<Toggle label="Заявки в друзья во время игры" checked={data().game.pollRequests} onChange={(value) => set(settings => { settings.game.pollRequests = value; })} />
							</SettingRow>
						</SettingGroup>
					</>
				}
				@if (tab() == "account") {
					<>
						<SettingGroup title="ПРОФИЛЬ">
							<SettingRow label="Пол">
								<div class="sexes">
									<button class={sex() === 0 ? "sex on" : "sex"} disabled={sexBusy()} onClick={() => void changeSex(0)}>{"♂ Мужской"}</button>
									<button class={sex() === 1 ? "sex on" : "sex"} disabled={sexBusy()} onClick={() => void changeSex(1)}>{"♀ Женский"}</button>
								</div>
							</SettingRow>
							@if (registered()) {
								<SettingRow label="Дата регистрации"><span class="value">{formatDateTime(registered()!)}</span></SettingRow>
							}
						</SettingGroup>
						<SettingGroup title="БЕЗОПАСНОСТЬ">
							<SettingRow label="Пароль" hint="Ссылка для смены придёт на почту"><button onClick={() => void resetPassword(ctx, ctx.host.account?.email ?? "")}>{"Сменить"}</button></SettingRow>
						</SettingGroup>
						@if (isAppMode()) {
							<SettingGroup title="АККАУНТ">
								<SettingRow label="Сменить аккаунт" hint="Откроется список аккаунтов"><button onClick={() => void ctx.host.window.close()}>{"Сменить"}</button></SettingRow>
							</SettingGroup>
						}
					</>
				}
				@if (tab() == "bafia") {
					<>
						<SettingGroup title="СЕРВЕР БАФИИ">
							<SettingRow label="Связь с сервером" hint="От неё зависят галочки, гифки и статистика">
								<span class="bafiaState" style={{ color: bafiaStatus().state == "connected" ? "#2fb44c" : bafiaStatus().state == "offline" ? "#d94452" : undefined }} data-keep>{statusText()}</span>
							</SettingRow>
							<SettingRow label="Гифки, ники и аватарки" hint="Согласие на отправку на сервер: история ников, гифки, GIF-аватарки">
								<Toggle label="Гифки, история ников и аватарки (сервер Бафии)" checked={bafiaOn()} onChange={(value, input) => void toggleBafia(value, input)} />
							</SettingRow>
						</SettingGroup>
						@if (bafiaOn()) {
							<>
								<SettingGroup title="TELEGRAM">
									<SettingRow label="Привязка" hint="Необязательно. Нажми, откроется бот: подтверди там привязку и вернись в игру">
										@if (tgLinked()) {
											<button onClick={() => void unlinkTelegram()}>{"Отвязать"}</button>
										} @else {
											<button disabled={tgLinked() === undefined} onClick={() => void linkTelegram()}>{"Привязать"}</button>
										}
									</SettingRow>
								</SettingGroup>
								<SettingGroup title="АВАТАРКА">
									<SettingRow label="GIF-аватарка" hint={premium() ? "Анимированная, до 16 МБ; её видят другие игроки Бафии" : "Нужен премиум; когда он закончится, аватарка скроется, но сохранится"}>
										@if (myAvatar()) {
											<img class="avatarPreview" src={myAvatar()} width="34" height="34" alt="" />
										}
										<button disabled={!premium() || avatarBusy()} onClick={() => avatarChooser.click()}>{avatarBusy() ? "Загрузка…" : myAvatar() ? "Заменить" : "Загрузить"}</button>
										@if (myAvatar() && !avatarBusy()) {
											<button onClick={() => void removeAvatar()}>{"Убрать"}</button>
										}
										<input ref={avatarChooser} type="file" accept="image/gif,image/webp,image/png" hidden onChange={(event) => void pickAvatar(event.currentTarget)} />
									</SettingRow>
									@if (avatarBusy()) {
										<div class="progress" role="progressbar" aria-label="Загрузка аватарки"><div></div></div>
									}
								</SettingGroup>
								<SettingGroup title="КАСТОМ ПРОФИЛЬ">
									<div class="preview" style={previewBg() ? { background: previewBg(), color: previewTheme()?.text ?? readableOn(previewBg()) } : undefined}>
										<div class="previewBanner" style={myBanner() ? { "background-image": `url("${myBanner()}")` } : undefined}>{myBanner() ? "" : "баннер"}</div>
										<div class="previewBody">
											<div class="photo"><Avatar photo={() => ctx.user.photo ?? ""} gif={() => myAvatar()} ring={() => avatarFrame(lookNow())} assets={ctx.assets} size={72} /></div>
											<div class="previewName" data-keep><span style={nickEffect(lookNow(), badgeColor())}>{ctx.user.username || "Твой ник"}</span></div>
											@if (lookNow().status) {
												<div class="previewStatus" data-keep>{lookNow().status}</div>
											}
											@if (lookNow().pin) {
												<div class="previewStatus">{"гифка закреплена"}</div>
											}
											<div class="previewStat"><span>{"Сыграно игр"}</span><b>{"123"}</b></div>
											<div class="previewStat"><span>{"Побед за Мафию"}</span><b>{"45"}</b></div>
										</div>
									</div>
									<SettingRow label="Баннер" hint={premium() ? "Картинка или GIF над аватаркой; видят игроки Бафии" : "Нужен премиум; видят игроки Бафии"}>
										<button disabled={!premium() || bannerBusy()} onClick={() => bannerChooser.click()}>{bannerBusy() ? "Загрузка…" : myBanner() ? "Заменить" : "Загрузить"}</button>
										@if (myBanner() && !bannerBusy()) {
											<button onClick={() => void removeBanner()}>{"Убрать"}</button>
										}
										<input ref={bannerChooser} type="file" accept="image/gif,image/webp,image/png" hidden onChange={(event) => void pickBanner(event.currentTarget)} />
									</SettingRow>
									@if (bannerBusy()) {
										<div class="progress" role="progressbar" aria-label="Загрузка баннера"><div></div></div>
									}
									<SettingRow label="Статус" hint={premium() ? "Строка под ником, до 60 символов" : "Нужен премиум"}>
										<input type="text" maxlength={BAFIA_LIMITS.status} disabled={!premium()} value={lookNow().status ?? ""} placeholder="О себе" style={{ width: "160px" }}
											onInput={(event) => setDraftStatus(event.currentTarget.value)} onChange={(event) => void changeLook({ status: event.currentTarget.value.trim() })} />
									</SettingRow>
									<SettingRow label="Рамка аватарки" hint={premium() ? "Цветная рамка вокруг аватарки" : "Нужен премиум"}>
										<div class="swatches">
											<button class={!myLook().frame ? "swatch on" : "swatch"} disabled={!premium()} style={{ background: "var(--surface)" }} aria-label="без рамки" onClick={() => void changeLook({ frame: undefined })}>{"×"}</button>
											@for (const [name, hex] of Object.entries(PREMIUM_COLORS)) {
												<button class={myLook().frame == name ? "swatch on" : "swatch"} disabled={!premium()} style={{ background: hex }} aria-label={name} onClick={() => void changeLook({ frame: name })}></button>
											}
										</div>
									</SettingRow>
									<SettingRow label="Эффект ника" hint={premium() ? "Цвет берётся от галочки" : "Нужен премиум"}>
										<button class={!myLook().effect ? "pick on" : "pick"} disabled={!premium()} onClick={() => void changeLook({ effect: undefined })}>{"Нет"}</button>
										@for (const name of PROFILE_EFFECTS) {
											<button class={myLook().effect == name ? "pick on" : "pick"} disabled={!premium()} onClick={() => void changeLook({ effect: name })}>{effectNames[name]}</button>
										}
									</SettingRow>
									<SettingRow label="Тема фона" hint={premium() ? "Готовый градиент, важнее цвета фона" : "Нужен премиум"}>
										<div class="swatches">
											<button class={!myLook().theme ? "swatch on" : "swatch"} disabled={!premium()} style={{ background: "var(--surface)" }} aria-label="без темы" onClick={() => void changeLook({ theme: undefined })}>{"×"}</button>
											@for (const name of Object.keys(PROFILE_THEMES) as ProfileTheme[]) {
												<button class={myLook().theme == name ? "swatch on" : "swatch"} disabled={!premium()} style={{ background: PROFILE_THEMES[name] }} title={themeNames[name]} aria-label={themeNames[name]} onClick={() => void changeLook({ theme: name })}></button>
											}
										</div>
									</SettingRow>
									<SettingRow label="Закреплённая гифка" hint={premium() ? (myLook().pin ? "Закреплена; видна в твоём профиле" : "Одна из избранных гифок, показывается в профиле") : "Нужен премиум"}>
										<button disabled={!premium()} onClick={() => void ctx.dialogs.manager.open({ title: "ЗАКРЕПЛЁННАЯ ГИФКА", render: (done) => PinPicker({ ctx, current: myLook().pin, choose: (id) => void changeLook({ pin: id }), close: done }) })}>{myLook().pin ? "Изменить" : "Выбрать"}</button>
										@if (myLook().pin) {
											<button onClick={() => void changeLook({ pin: undefined })}>{"Убрать"}</button>
										}
									</SettingRow>
									<SettingRow label="Цвет фона" hint={premium() ? "Фон твоего профиля" : "Нужен премиум"}>
										<input type="color" disabled={!premium()} value={previewBg() ?? "#ffffff"} onInput={(event) => setDraftBg(event.currentTarget.value)} onChange={(event) => void saveBg(event.currentTarget.value)} />
										@if (myBg()) {
											<button onClick={() => void saveBg("")}>{"Сбросить"}</button>
										}
									</SettingRow>
								</SettingGroup>
								<SettingGroup title="ПРЕМИУМ">
									<SettingRow label={premium() ? "Премиум до " + new Date(premium()!).toLocaleDateString("ru-RU") : "Премиум"} hint="Цветная галочка с рамкой и история игр дольше">
										<span class="pstate" style={{ background: premiumStates[premiumState()][0] }} title={premiumStates[premiumState()][1]} aria-label={premiumStates[premiumState()][1]}></span>
										<button onClick={() => void buyPremium()}>{premium() ? "Продлить" : "Купить"}</button>
										<button onClick={() => void enterCode()}>{"Ввести код"}</button>
									</SettingRow>
									@if (premium()) {
										<SettingRow label="Цвет фона галочки">
											<div class="swatches">
												@for (const [name, hex] of Object.entries(PREMIUM_COLORS)) {
													<button class={ctx.bafia.color == name ? "swatch on" : "swatch"} style={{ background: hex }} aria-label={name} onClick={() => ctx.bafia.setColor(name)}></button>
												}
											</div>
										</SettingRow>
									}
								</SettingGroup>
							</>
						}
					</>
				}
				@if (tab() == "more") {
					<>
						<SettingGroup title="ДОПОЛНИТЕЛЬНО">
							<SettingRow label="Моды" hint="Расширения игры"><button onClick={() => ctx.nav.push("mods")}>{"Открыть"}</button></SettingRow>
							<SettingRow label="Режим разработчика">
								<Toggle label="Режим разработчика" checked={data().developer} onChange={(value) => set(settings => { settings.developer = value; })} />
							</SettingRow>
							<SettingRow label="Логи" hint="Отчёт для разработчика при проблеме">
								<button onClick={() => void ctx.dialogs.manager.open({ title: "ЛОГИ", wide: true, render: (close) => LogsView({ close }) })}>{"Получить"}</button>
							</SettingRow>
						</SettingGroup>
						<SettingGroup title="О ПРОГРАММЕ">
							<SettingRow label="Версия"><span class="value" data-keep>{version}</span></SettingRow>
						</SettingGroup>
					</>
				}
			</div>
		</div>
	</>
}
