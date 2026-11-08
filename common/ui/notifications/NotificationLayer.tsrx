import { createSignal, fromEvents } from "@common/ui";
import type { NotificationCenter } from "./center";

/**
 * баннеры уведомлений: плашка с цветным значком, заголовок и текст
 * в правом верхнем углу (на телефоне на всю ширину), новые сверху; нажатие закрывает
 * цвета следуют за светлой/тёмной темой системы. Значки свои (SVG), не эмодзи
 */
export function NotificationLayer({ center }: { center: NotificationCenter }) @{
	// у macOS самое новое уведомление сверху
	const items = fromEvents(center, "change", () => [...center.items].reverse());

	// ответ на уведомление (как в macOS): одно поле ввода за раз
	const [replying, setReplying] = createSignal<number | undefined>(undefined);
	const [draft, setDraft] = createSignal("");
	const [busy, setBusy] = createSignal(false);
	const [problem, setProblem] = createSignal("");
	const openReply = (id: number) => { setDraft(""); setProblem(""); setReplying(id); center.hold(id); };
	const send = async (item: (typeof center.items)[number]) => {
		const text = draft().trim();
		if(!text || busy() || !item.reply) return;
		setBusy(true);
		setProblem("");
		const error = await item.reply.send(text);
		setBusy(false);
		if(error) return setProblem(error);
		setReplying(undefined);
		center.dismissId(item.id);
		center.show({ title: "Ответ отправлен", kind: "success", timeout: 2500, key: "reply-sent" });
	};

	<>
		<style>
			.stack { --bg: rgba(248, 248, 250, .78); --text: #1d1d1f; --sub: rgba(29, 29, 31, .68); --meta: rgba(29, 29, 31, .45); --border: rgba(0, 0, 0, .12); --close-bg: rgba(250, 250, 252, .95); --close-text: rgba(0, 0, 0, .6); position: fixed; top: 10px; right: 10px; width: min(344px, calc(100vw - 20px)); display: flex; flex-direction: column; gap: 8px; z-index: 9500; pointer-events: none; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif; }
			@media (prefers-color-scheme: dark) { .stack { --bg: rgba(48, 48, 52, .74); --text: #f5f5f7; --sub: rgba(245, 245, 247, .72); --meta: rgba(245, 245, 247, .45); --border: rgba(255, 255, 255, .14); --close-bg: rgba(70, 70, 76, .95); --close-text: rgba(255, 255, 255, .75); } }
			.banner { position: relative; pointer-events: auto; display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px 11px 10px; border-radius: 14px; background: var(--bg); color: var(--text); box-shadow: 0 0 0 .5px var(--border), 0 10px 30px rgba(0, 0, 0, .25), 0 1px 4px rgba(0, 0, 0, .18); backdrop-filter: blur(30px) saturate(1.8); -webkit-backdrop-filter: blur(30px) saturate(1.8); animation: slide-in .42s cubic-bezier(.22, 1.1, .36, 1); cursor: default; user-select: none; -webkit-user-select: none; }
			.icon { flex: none; width: 36px; height: 36px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 0 .5px rgba(0, 0, 0, .12), 0 1px 2px rgba(0, 0, 0, .2); }
			.banner.action { cursor: pointer; }
			.icon svg { width: 22px; height: 22px; display: block; }
			.icon.info { background: linear-gradient(180deg, #5ac8fa, #0a84ff); }
			.icon.success { background: linear-gradient(180deg, #6bdc7e, #2fb44c); }
			.icon.warning { background: linear-gradient(180deg, #ffd25f, #ff9f0a); }
			.icon.error { background: linear-gradient(180deg, #ff8a80, #ff3b30); }
			.body { flex: 1; min-width: 0; padding-top: 1px; }
			.head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
			.title { font-size: 13px; font-weight: 600; line-height: 1.3; min-width: 0; overflow-wrap: anywhere; }
			.source { flex: none; font-size: 11px; color: var(--meta); }
			.text { font-size: 13px; color: var(--sub); line-height: 1.3; margin-top: 1px; overflow-wrap: anywhere; }
			.close { position: absolute; top: -7px; left: -7px; width: 20px; height: 20px; padding: 0; border-radius: 50%; border: 0; background: var(--close-bg); color: var(--close-text); box-shadow: 0 0 0 .5px var(--border), 0 1px 4px rgba(0, 0, 0, .3); display: flex; align-items: center; justify-content: center; opacity: 0; transform: scale(.7); transition: opacity .12s, transform .12s; cursor: pointer; }
			.close svg { width: 10px; height: 10px; display: block; }
			.banner:hover .close, .close:focus-visible { opacity: 1; transform: none; }
			.reply-btn { margin-top: 6px; padding: 2px 10px; border: 0; border-radius: 999px; font: inherit; font-size: 11px; font-weight: 600; color: var(--text); background: var(--close-bg); box-shadow: 0 0 0 .5px var(--border); cursor: pointer; }
			.reply-btn:hover { filter: brightness(.95); }
			.composer { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
			.composer textarea { width: 100%; box-sizing: border-box; min-height: 52px; resize: none; padding: 6px 8px; border-radius: 8px; border: 0; font: inherit; font-size: 13px; color: var(--text); background: var(--close-bg); box-shadow: 0 0 0 .5px var(--border); }
			.composer .row { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
			.composer .row button { padding: 3px 12px; border: 0; border-radius: 999px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; color: var(--text); background: var(--close-bg); box-shadow: 0 0 0 .5px var(--border); }
			.composer .row button.primary { color: #fff; background: #0a84ff; box-shadow: none; }
			.composer .row button:disabled { opacity: .5; cursor: default; }
			.composer .problem { flex: 1; font-size: 11px; color: #ff453a; }
			@keyframes slide-in { from { opacity: 0; transform: translateX(60px) scale(.97); } to { opacity: 1; transform: none; } }
			@media (max-width: 600px) { .stack { left: 10px; right: 10px; width: auto; } .close { opacity: 1; transform: none; } @keyframes slide-in { from { opacity: 0; transform: translateY(-40px) scale(.97); } to { opacity: 1; transform: none; } } }
			@media (prefers-reduced-motion: reduce) { .banner { animation: none; } .close { transition: none; } }
		</style>
		<div class="stack" role="status" aria-live="polite">
			@for (const item of items()) {
				<div class={item.action ? "banner action" : "banner"} onClick={() => { if(replying() == item.id) return; item.action?.(); center.dismissId(item.id); }}>
					<button class="close" aria-label="Закрыть" onClick={(event) => { event.stopPropagation(); center.dismissId(item.id); }}>
						<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 2l6 6M8 2L2 8"></path></svg>
					</button>
					<div class={"icon " + item.kind} aria-hidden="true">
						@if (item.kind == "success") {
							<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 12.8l4.2 4.2 8.8-9.6"></path></svg>
						} @else {
							@if (item.kind == "warning") {
								<svg viewBox="0 0 24 24" fill="#fff"><rect x="10.7" y="5.5" width="2.6" height="8.6" rx="1.3"></rect><circle cx="12" cy="17.8" r="1.6"></circle></svg>
							} @else {
								@if (item.kind == "error") {
									<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"></path></svg>
								} @else {
									<svg viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="7" r="1.7"></circle><rect x="10.7" y="10.2" width="2.6" height="8" rx="1.3"></rect></svg>
								}
							}
						}
					</div>
					<div class="body">
						<div class="head">
							<div class="title">{item.title}</div>
							<div class="source">{item.source}</div>
						</div>
						@if (item.text) {
							<div class="text">{item.text}</div>
						}
						@if (item.reply) {
							@if (replying() == item.id) {
								<div class="composer" onClick={(event) => event.stopPropagation()}>
									<textarea
										placeholder={item.reply.placeholder ?? "Ответ"}
										maxlength="1000"
										value={draft()}
										ref={(element: HTMLTextAreaElement) => queueMicrotask(() => element.focus())}
										onInput={(event) => setDraft(event.currentTarget.value)}
										onKeyDown={(event) => { if(event.key == "Enter" && !event.shiftKey) { event.preventDefault(); void send(item); } else if(event.key == "Escape") setReplying(undefined); }}
									></textarea>
									<div class="row">
										<span class="problem">{problem()}</span>
										<button onClick={() => setReplying(undefined)}>{"Отмена"}</button>
										<button class="primary" disabled={busy() || !draft().trim()} onClick={() => void send(item)}>{busy() ? "…" : "Отправить"}</button>
									</div>
								</div>
							} @else {
								<button class="reply-btn" onClick={(event) => { event.stopPropagation(); openReply(item.id); }}>{"Ответить"}</button>
							}
						}
					</div>
				</div>
			}
		</div>
	</>
}
