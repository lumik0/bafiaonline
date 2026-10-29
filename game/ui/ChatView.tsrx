// @ts-nocheck
import { createEffect, createSignal, fromEvents, onCleanup, onMount } from "@common/ui";
import type { Assets } from "@common/assets";
import { formatDateTime } from "@common/utils/format";
import { animationOf, DecorationType, nickStyle, photoRing } from "../domain/decorations";
import { colorToken, parseText, stableRows, toneToken, toRows, type ChatEntry, type Row } from "../domain/chat/message";
import { Avatar } from "./Avatar.tsrx";
import { Lottie } from "./Lottie.tsrx";
import { ChatInput } from "./ChatInput.tsrx";
import { GifMessage } from "./GifMessage.tsrx";
import { HistoryMessage } from "./HistoryMessage.tsrx";
import { PremiumBadge } from "./PremiumBadge.tsrx";
import { premiumFrame } from "../domain/premium-style";
import type { Bafia } from "../domain/bafia";
import type { GameContext } from "../context";

const EMOJI = ["sm1", "sm2", "sm3", "sm4", "sm5", "sm6"];

/** действия для других частей (например, список игроков вставляет ник) */
export interface ChatController {
	mention?: (username: string) => void
}

/** общая часть всех чатов: сообщения по группам, смайлики, упоминания, ввод. Данные и отправку даёт экран */
export function ChatView({ ctx, entries, myName, hideName, assets, send, onAvatar, controller, note, expand, extra, nickPrefix, readonly, externalInput, bafia, openHistory, history, placeholder = "Сообщение" }: {
	ctx: GameContext,
	entries: () => readonly ChatEntry[], myName: () => string, hideName: () => boolean, assets: Assets,
	send: (text: string) => void, onAvatar?: (playerObjectId: string) => void, controller?: ChatController,
	note?: () => string, placeholder?: string,
	/** «@3 » → ник игрока №3 (в комнате) */
	expand?: (number: number) => string | undefined,
	/** добавка под строкой (кнопки голосования за исключение) */
	extra?: (entry: ChatEntry) => unknown,
	/** номер игрока перед ником (в игре, если включено в настройках) */
	nickPrefix?: (username: string) => string | undefined,
	/** только чтение (просмотр игры из истории): без поля ввода */
	readonly?: boolean,
	/** поле ввода рисует сам экран (ChatInput): например, на телефоне оно на всю ширину под столом */
	externalInput?: boolean,
	/** сервер Бафии: гифки в сообщениях и кнопка выбора */
	bafia?: Bafia,
	/** игра из ссылки `[hist:…]`: открыть (только в личных сообщениях) */
	openHistory?: (id: string) => void,
	/** кнопка «отправить игру из истории» у поля ввода (только в личных сообщениях) */
	history?: () => void
}) @{
	let scroller!: HTMLDivElement;
	// премиум Бафии: значок и рамка ника в его цвете
	const bafiaVersion = bafia ? fromEvents(bafia, "change", () => ({})) : () => 0;
	const premiumColor = (id: string | undefined) => { bafiaVersion(); return id ? bafia?.premiumColor(id) : undefined; };
	const emoji = fromEvents(assets, "change", () => Object.fromEntries(EMOJI.map(name => [name, assets.url(`textures/emoji/${name}.png`)])) as Record<string, string>);

	let previous: Row[] = [];
	// заглушенные игроки: их сообщения не показываем
	const muted = ctx?.settings ? fromEvents(ctx.settings, "change", () => new Set(ctx.settings.data.muted)) : () => new Set<string>();
	const visible = () => entries().filter(entry => entry.kind != "message" || !entry.user?.objectId || !muted().has(entry.user.objectId));
	const rows = () => previous = stableRows(previous, toRows(visible()));

	// к новым сообщениям прокручиваем, только если читатель и так внизу: старую переписку не сбиваем
	let stick = true;
	const onScroll = () => { stick = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop < 75; };
	createEffect(() => {
		entries();
		queueMicrotask(() => { if(stick && scroller) scroller.scrollTo({ top: scroller.scrollHeight }); });
	});

	const lineColor = (entry: ChatEntry) => "var(--" + (entry.tone ? toneToken(entry.tone) : colorToken(entry.type)) + ")";
	<>
		<style>
			.chat { display: flex; flex-direction: column; height: 100%; min-height: 0; }
			.messages { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; margin: 8px 10px 5px; border-radius: 4px; outline: 2px solid rgba(190, 190, 190, .8); background: var(--chat-panel); color: var(--chat-text); }
			.group { display: flex; gap: 6px; padding: 4px 6px; text-align: left; align-items: flex-start; }
			.column { display: flex; flex-direction: column; min-width: 0; word-break: break-word; }
			.nick { position: relative; isolation: isolate; color: var(--chat-name); font-weight: 600; font-size: 13px; cursor: pointer; align-self: flex-start; }
			.vip { margin-left: 4px; }
			.label { font-weight: 400; font-size: 11px; opacity: .85; }
			.blur { filter: blur(5px); }
			.text { user-select: text; -webkit-user-select: text; font-size: 14px; line-height: 1.35; padding: 1px 0px; border-radius: 4px; }
			.text.unread { background: var(--chat-unread-bg); }
			.time { display: block; font-size: 10px; opacity: .6; }
			.mention, .index { color: var(--chat-mention); font-weight: 700; }
			.text img, .emoji { width: 20px; height: 20px; vertical-align: middle; margin: 0 2px; }
			.line { margin: 3px 8px; text-align: center; font-size: 13px; white-space: pre-line; user-select: text; -webkit-user-select: text; }
			.event { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 4px; }
			.who { display: inline-flex; cursor: pointer; }
			.link { cursor: pointer; font-weight: 600; }
			.note { padding: 0 12px 2px; font-size: 12px; opacity: .8; }
		</style>
		<div class="chat">
			<div class="messages" ref={scroller} onScroll={onScroll}>
				@for (const row of rows()) {
					@if (row.type == "group") {
						<div class="group">
							<div onClick={() => onAvatar?.(row.group.user.playerObjectId ?? "")}><Avatar photo={() => row.group.user.photo ?? ""} asset={() => row.group.user.asset} ring={() => photoRing(row.group.user.decorations)} animation={() => animationOf(row.group.user.decorations, DecorationType.PhotoBorderAnimation)} assets={assets} size={35} /></div>
							<div class="column">
								<span class={hideName() && row.group.user.username == myName() ? "nick blur" : "nick"} data-keep style={{ ...nickStyle(row.group.user.decorations), ...premiumFrame(premiumColor(row.group.user.playerObjectId)), ...(row.group.entries[0]?.nickTone ? { color: "var(--" + toneToken(row.group.entries[0].nickTone) + ")" } : {}) }} onClick={() => controller?.mention?.(row.group.user.username)}>
									{animationOf(row.group.user.decorations, DecorationType.UsernameAnimation) ? <Lottie animation={() => animationOf(row.group.user.decorations, DecorationType.UsernameAnimation)} inset="-15% -10%" /> : null}{nickPrefix?.(row.group.user.username) ? <span class="index">{nickPrefix(row.group.user.username)}</span> : null}{row.group.user.username}{premiumColor(row.group.user.playerObjectId) ? <PremiumBadge color={premiumColor(row.group.user.playerObjectId)!} /> : null}<span class="vip">{row.group.user.vip ?? ""}</span>{row.group.entries[0]?.label ? <span class="label">{" · " + row.group.entries[0].label}</span> : null}
								</span>
								@for (const entry of row.group.entries) {
									<span class={entry.unread ? "text unread" : "text"} data-keep style={{ color: lineColor(entry) }}>
										@for (const part of parseText(entry.text, myName())) {
											@if (part.kind == "emoji") {
												<img src={emoji()[part.name]} alt={part.name} />
											} @else if (part.kind == "hist") {
												<HistoryMessage bafia={bafia} id={part.id} open={openHistory} />
											} @else if (part.kind == "gif") {
												<GifMessage bafia={bafia} id={part.id} />
											} @else if (part.kind == "mention") {
												<span class={part.mine ? (hideName() ? "mention blur" : "mention") : ""} data-keep>{part.text}</span>
											} @else {
												<span>{part.text}</span>
											}
										}
										@if (entry.created) {
											<span class="time">{formatDateTime(entry.created)}</span>
										}
									</span>
								}
							</div>
						</div>
					} @else if (row.entry.kind == "join" || row.entry.kind == "leave" || row.entry.kind == "kill") {
						<div class="line event" style={{ color: row.entry.kind == "join" ? "var(--chat-join)" : row.entry.kind == "leave" ? "var(--chat-leave)" : "var(--chat-danger)" }}>
							<span>{"Игрок "}</span>
							<span class="who" onClick={() => onAvatar?.(row.entry.user?.playerObjectId ?? "")}><Avatar photo={() => row.entry.user?.photo ?? ""} ring={() => photoRing(row.entry.user?.decorations)} assets={assets} size={20} /></span>
							<span class={hideName() && row.entry.user?.username == myName() ? "link blur" : "link"} data-keep style={nickStyle(row.entry.user?.decorations)} onClick={() => controller?.mention?.(row.entry.user?.username ?? "")}>{row.entry.user?.username ?? ""}</span>
							<span>{row.entry.kind == "join" ? " вошёл" : row.entry.kind == "leave" ? " вышел" : " " + row.entry.text}</span>
						</div>
					} @else {
						<div class="line" style={{ color: lineColor(row.entry) }}>
							@for (const part of parseText(row.entry.text, myName())) {
								@if (part.kind == "mention") {
									<span class={part.mine ? (hideName() ? "mention blur" : "mention") : ""} data-keep>{part.text}</span>
								} @else {
									<span>{part.text}</span>
								}
							}
							{extra ? extra(row.entry) : null}
						</div>
					}
				}
			</div>
			@if (note && note()) {
				<div class="note">{note()}</div>
			}
			@if (!readonly && !externalInput) {
				<ChatInput ctx={ctx} assets={assets} send={send} expand={expand} controller={controller} bafia={bafia} history={history} placeholder={placeholder} />
			}
		</div>
	</>
}
