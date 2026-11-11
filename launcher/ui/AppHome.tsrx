import { createSignal, fromEvents, onMount } from "@common/ui";
import { DISCLAIMER_SHORT } from "@common/constants";
import { version } from "@common/version";
import { accountKey, accountTitle, type LauncherModel } from "../model";

const NEWS_URL = "https://raw.githubusercontent.com/lumik0/bafiaonline/refs/heads/master/core/newnews.txt";
const photoUrl = (photo: string) => `https://dottap.com/mafia/profile_photo/${photo}`;
const LINKS = [
	{ title: "Telegram-канал", hint: "t.me/bafiaonline", url: "https://t.me/bafiaonline" },
	{ title: "Идеи, баги, регистрация", hint: "@bafiaonlinebot", url: "https://t.me/bafiaonlinebot" },
	{ title: "Исходный код", hint: "github.com/lumik0/bafiaonline", url: "https://github.com/lumik0/bafiaonline" }
];

/** главный экран приложения: аккаунты (нажал - играешь), новости, ссылки. Вид Material, цвета из темы */
export function AppHome({ model }: { model: LauncherModel }) @{
	const state = fromEvents(model, "change", () => ({ accounts: model.accounts, selected: model.selected, status: model.status, syncing: model.syncing, progress: model.progress }));
	const [news, setNews] = createSignal<string[]>([]);

	onMount(async() => {
		try {
			const response = await fetch(NEWS_URL);
			if(response.ok) setNews((await response.text()).split("\n").filter(Boolean));
		} catch {}
	});

	<>
		<style>
			.home { display: flex; flex-direction: column; height: 100%; background: var(--bg); color: var(--text); }
			.top { flex: none; display: flex; flex-direction: column; justify-content: center; min-height: 64px; box-sizing: border-box; padding: 8px 16px; background: var(--header-bg); color: var(--header-text); }
			.top .name { font-size: 22px; }
			.top .version { font-size: 12px; opacity: .8; }
			.scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 16px 24px; display: flex; flex-direction: column; gap: 8px; }
			.section { margin: 12px 4px 0; font-size: 14px; font-weight: 500; color: var(--accent); }
			.list { border-radius: 16px; overflow: hidden; background: rgba(128, 128, 128, .16); }
			.item { display: flex; align-items: center; gap: 16px; min-height: 64px; box-sizing: border-box; padding: 8px 8px 8px 16px; border-bottom: 1px solid rgba(128, 128, 128, .2); color: inherit; text-decoration: none; }
			.item:last-child { border-bottom: none; }
			.item:active { background: rgba(128, 128, 128, .18); }
			.item.selected { background: rgba(128, 128, 128, .12); }
			.avatar { flex: none; width: 40px; height: 40px; border-radius: 50%; background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; overflow: hidden; }
			.avatar img { width: 100%; height: 100%; object-fit: cover; }
			.texts { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; padding: 4px 0; }
			.primary { font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
			.secondary { font-size: 13px; opacity: .7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
			.icon { flex: none; width: 48px; height: 48px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; background-color: transparent; color: inherit; opacity: .75; }
			.icon:enabled:hover, .icon:enabled:active { background-color: transparent; }
			.add { align-self: flex-start; margin-top: 4px; padding: 10px 24px 10px 16px; display: flex; align-items: center; gap: 8px; }
			.add span { font-size: 20px; line-height: 1; }
			progress { width: 100%; }
			.status { min-height: 16px; margin: 0 4px; font-size: 13px; opacity: .8; }
			.card { padding: 14px 16px; border-radius: 16px; background: rgba(128, 128, 128, .16); font-size: 14px; line-height: 1.5; user-select: text; -webkit-user-select: text; }
			.card p { margin: 0; }
			.danger { align-self: flex-start; }
			.disclaimer { margin: 12px 4px 0; font-size: 12px; line-height: 1.4; opacity: .6; }
		</style>
		<div class="home">
			<div class="top">
				<span class="name">{"Бафия онлайн"}</span>
				<span class="version">{version}</span>
			</div>
			<div class="scroll">
				<div class="section">{"Аккаунты"}</div>
				@if (state().accounts.length) {
					<div class="list">
						@for (const account of state().accounts) {
							<div class={state().selected && accountKey(state().selected!) == accountKey(account) ? "item selected" : "item"} onClick={() => { if(!state().syncing) void model.play(account); }}>
								<div class="avatar">
									@if (account.photo) {
										<img src={photoUrl(account.photo)} alt="" onError={(event) => event.currentTarget.remove()} />
									} @else {
										<span>{accountTitle(account).slice(0, 1).toUpperCase()}</span>
									}
								</div>
								<div class="texts">
									<span class="primary">{accountTitle(account)}</span>
									@if (account.email && account.email != accountTitle(account)) {
										<span class="secondary">{account.email}</span>
									}
								</div>
								<button class="icon" aria-label="Удалить аккаунт" onClick={(event) => { event.stopPropagation(); void model.remove(account); }}>
									<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
								</button>
							</div>
						}
					</div>
				}
				<button class="add" disabled={state().syncing} onClick={() => void model.play()}><span>{"+"}</span>{state().accounts.length ? "Добавить аккаунт" : "Войти в аккаунт"}</button>
				@if (state().syncing) {
					<progress value={state().progress.value} max={state().progress.max}></progress>
				}
				<div class="status">{state().status}</div>

				@if (news().length) {
					<>
						<div class="section">{"Что нового"}</div>
						<div class="card">
							@for (const line of news()) {
								<p>{line}</p>
							}
						</div>
					</>
				}

				<div class="section">{"Ссылки"}</div>
				<div class="list">
					@for (const link of LINKS) {
						<a class="item" href={link.url} target="_blank" rel="noopener">
							<div class="texts">
								<span class="primary">{link.title}</span>
								<span class="secondary">{link.hint}</span>
							</div>
						</a>
					}
				</div>

				<div class="section">{"Данные"}</div>
				<button class="gray danger" onClick={() => void model.eraseEverything()}>{"Очистить все данные"}</button>
				<p class="disclaimer">{DISCLAIMER_SHORT}</p>
			</div>
		</div>
	</>
}
