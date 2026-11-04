import { fromEvents, onCleanup, onMount } from "@common/ui";
import { PrivateChat, toEntries } from "../domain/chat/private";
import { copyText } from "@common/utils/clipboard";
import type { ChatEntry } from "../domain/chat/message";
import { noteHint, outcomeOf, ownRecords, recordTitle } from "../domain/history";
import { sessionDeps } from "../domain/room/deps";
import { RoomSession } from "../domain/room/session";
import { formatDateTime } from "@common/utils/format";
import { AppBar } from "../ui/AppBar.tsrx";
import { ChatView } from "../ui/ChatView.tsrx";
import type { GameContext } from "../context";

export function PrivateChatScreen({ ctx, friendshipId, playerObjectId, username, photo }: { ctx: GameContext, friendshipId: string, playerObjectId: string, username: string, photo?: string }) @{
	const chat = new PrivateChat(ctx.client, ctx.settings, friendshipId);

	const myName = fromEvents(ctx.user, "change", () => ctx.user.username);
	const hideName = fromEvents(ctx.settings, "change", () => ctx.settings.data.hideUsername);
	const background = fromEvents(ctx.assets, "change", () => ctx.assets.url("textures/backgrounds/day3.png"));

	/** сообщения собеседника и ваши - в виде строк чата; ваше непрочитанное подсвечено, неизменившиеся строки остаются теми же объектами */
	let known = new Map<number, ChatEntry>();
	const entries = fromEvents(chat, "change", (): ChatEntry[] => {
		const me = { playerObjectId: ctx.user.playerObjectId, username: ctx.user.username, photo: ctx.user.photo };
		const result = toEntries(chat.visible, known, me, { playerObjectId, username, photo });
		known = result.known;
		return result.list;
	});
	/**
	 * долгое нажатие или правая кнопка на сообщении: копировать; своё сообщение можно удалить у обоих (как в официальном приложении),
	 * чужое - только скрыть у себя (сервер чужие не удаляет)
	 */
	const messageMenu = async (entry: ChatEntry, event: Event) => {
		const mine = chat.messages.find(item => item.id == entry.id)?.from == ctx.user.playerObjectId;
		const choice = await ctx.dialogs.choose(event, { title: "Сообщение", labels: ["Копировать", mine ? "Удалить" : "Скрыть у себя"] });
		if(choice == 0) await copyText(entry.text);
		else if(choice == 1 && !mine) chat.hide(entry.id);
		else if(choice == 1 && await ctx.dialogs.confirm("Удалить сообщение? Оно пропадёт и у собеседника.", { title: "УДАЛИТЬ", yes: "Удалить" })) {
			// у сообщения нет номера на сервере (старый ответ без него): тогда хотя бы скрываем у себя
			if(!chat.remove(entry.id)) chat.hide(entry.id);
		}
	};
	const note = fromEvents(chat, "change", () => chat.typing ? username + " печатает…" : "");

	const resultWord = { win: "победа", lose: "поражение", draw: "ничья" } as const;
	/** отправить игру из истории: выкладывается на сервер Бафии на 30 дней, в сообщение идёт ссылка */
	const sendHistory = async () => {
		const rooms = ownRecords(ctx.history.data.rooms, { userObjectId: ctx.user.userObjectId, playerObjectId: ctx.user.playerObjectId }).slice(0, 12);
		if(!rooms.length) return ctx.dialogs.alert("В истории пока нет игр.", { title: "История" });
		const choice = await ctx.dialogs.choose(undefined, {
			title: "КАКУЮ ИГРУ ОТПРАВИТЬ",
			labels: rooms.map(record => { const outcome = outcomeOf(record, ctx.user.playerObjectId); return recordTitle(record) + " · " + formatDateTime(record.createdAt) + (outcome ? " · " + resultWord[outcome] : "") + noteHint(record); })
		});
		if(choice === undefined) return;
		if(!await ctx.dialogs.confirm("В игре есть ники и сообщения всех игроков комнаты. Она будет храниться на сервере Бафии 30 дней, посмотреть её сможет тот, кому придёт ссылка.", { title: "ОТПРАВИТЬ ИГРУ", yes: "Отправить" })) return;
		const result = await ctx.bafia.shareHistory(rooms[choice]!);
		if("id" in result) chat.send("[hist:" + result.id + "]");
		else await ctx.dialogs.alert({ offline: "Сервер Бафии сейчас недоступен.", quota: "Слишком много отправленных игр: подожди, пока старые устареют.", "too-big": "Игра слишком большая для отправки. С премиумом лимит втрое выше." }[result.error], { title: "Не отправилось" });
	};

	/** игра из ссылки: загружается только по нажатию, открывается как обычный просмотр из истории */
	const openHistory = async (id: string) => {
		const record = await ctx.bafia.loadHistory(id);
		if(!record) return void ctx.dialogs.alert(record === null ? "Игры по этой ссылке уже нет или она повреждена." : "Сервер Бафии сейчас недоступен.", { title: "Игра" });
		ctx.nav.push("room", { session: RoomSession.fromHistory(sessionDeps(ctx), record, "shared:" + id) });
	};

	onMount(() => chat.open());
	// после переподключения подписка на переписку пропадает: открываем заново, иначе сообщения перестают показываться
	const reconnect = ctx.auth.on("signedIn", (_account, reconnected) => { if(reconnected) chat.resubscribe(); });
	onCleanup(() => { reconnect.remove(); chat.close(); });

	<>
		<style>
			.page { display: flex; flex-direction: column; height: 100%; background-size: cover; background-position: center; }
		</style>
		<div class="page" style={{ "background-image": background() ? "url(" + background() + ")" : "none" }}>
			<AppBar title={username} keepCase onBack={() => ctx.nav.pop()} />
			<ChatView ctx={ctx} entries={entries} myName={myName} hideName={hideName} assets={ctx.assets} send={(text: string) => chat.send(text)} note={note} onMenu={messageMenu} onAvatar={(id: string) => ctx.openProfile(id)} bafia={ctx.bafia} history={sendHistory} openHistory={openHistory} />
		</div>
	</>
}
