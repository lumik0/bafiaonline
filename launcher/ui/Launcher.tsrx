import { createSignal, fromEvents, onMount } from "@common/ui";
import { accountKey, accountTitle, type LauncherModel } from "../model";

// новости новой игры; `core/news.txt` - для старой версии
const NEWS_URL = "https://raw.githubusercontent.com/lumik0/bafiaonline/refs/heads/master/core/newnews.txt";
const photoUrl = (photo: string) => `https://dottap.com/mafia/profile_photo/${photo}`;

export function Launcher({ model, openSettings }: { model: LauncherModel, openSettings: () => void }) @{
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
			.launcher { display: flex; flex-direction: column; gap: 10px; padding: 10px; height: 100%; box-sizing: border-box; overflow: auto; }
			.heading { margin: 0 4px; font-size: 13px; opacity: .8; }
			.accounts { display: flex; gap: 8px; overflow-x: auto; padding: 10px; border-radius: 8px; background: rgba(255, 255, 255, .06); min-height: 96px; }
			.card {
				position: relative; width: 68px; flex: none; display: flex; flex-direction: column; align-items: center; gap: 4px;
				padding: 8px 4px 6px; border-radius: 8px; background: rgba(255, 255, 255, .1); cursor: pointer;
				transition: background .15s, transform .15s; border: 2px solid transparent;
			}
			.card:hover { background: rgba(255, 255, 255, .16); }
			.card.selected { border-color: var(--accent); background: rgba(255, 255, 255, .18); }
			.avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 20px; overflow: hidden; }
			.avatar img { width: 100%; height: 100%; object-fit: cover; }
			.nick { font-size: 11px; max-width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
			.remove { position: absolute; top: 2px; right: 2px; width: 16px; height: 16px; padding: 0; line-height: 1; font-size: 11px; border-radius: 50%; opacity: 0; }
			.card:hover .remove { opacity: 1; }
			.add .avatar { background: transparent; border: 2px dashed var(--surface-border); font-size: 26px; }
			.actions { display: flex; gap: 6px; }
			.actions .play { flex: 1; padding: 10px; font-size: 16px; }
			progress { width: 100%; }
			.status { font-size: 12px; min-height: 14px; opacity: .8; }
			.news { font-size: 12px; line-height: 1.5; opacity: .85; user-select: text; -webkit-user-select: text; }
			.news p { margin: 0; }
			.links { font-size: 12px; opacity: .8; user-select: text; -webkit-user-select: text; }
			.links a { color: var(--accent); }
		</style>
		<div class="launcher">
			<p class="heading">{"Выбери аккаунт"}</p>
			<div class="accounts">
				@for (const account of state().accounts) {
					<div class={"card" + (state().selected && accountKey(state().selected!) == accountKey(account) ? " selected" : "")} onClick={() => model.select(account)} onDblClick={() => void model.play(account)}>
						<div class="avatar">
							@if (account.photo) {
								<img src={photoUrl(account.photo)} alt="" onError={(event) => event.currentTarget.remove()} />
							} @else {
								<span>{accountTitle(account).slice(0, 1).toUpperCase()}</span>
							}
						</div>
						<span class="nick" title={account.email ?? ""}>{accountTitle(account)}</span>
						<button class="remove" title="Удалить" onClick={(event) => { event.stopPropagation(); void model.remove(account); }}>{"×"}</button>
					</div>
				}
				<div class="card add" onClick={() => void model.play()}>
					<div class="avatar">{"+"}</div>
					<span class="nick">{"Новый"}</span>
				</div>
			</div>
			<div class="actions">
				<button class="play" disabled={state().syncing} onClick={() => void model.play(state().selected)}>{"Играть"}</button>
				<button onClick={openSettings}>{"Настройки"}</button>
			</div>
			@if (state().syncing) {
				<progress value={state().progress.value} max={state().progress.max}></progress>
			}
			<div class="status">{state().status}</div>
			<div class="news">
				@for (const line of news()) {
					<p>{line}</p>
				}
			</div>
			<div class="links">
				{"Идеи/Баги/Проблемы? "}<a href="https://t.me/bafiaonlinebot" target="_blank">{"@bafiaonlinebot"}</a><br />
				{"Github: "}<a href="https://github.com/lumik0/bafiaonline" target="_blank">{"lumik0/bafiaonline"}</a><br />
				{"Telegram: "}<a href="https://t.me/bafiaonline" target="_blank">{"t.me/bafiaonline"}</a><br />
				<br />
				{"Старая версия: "}<a href="./run/index.html">{"Перейти"}</a>
			</div>
		</div>
	</>
}
