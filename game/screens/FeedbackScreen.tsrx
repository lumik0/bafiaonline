import { createSignal } from "@common/ui";
import { BAFIA_LIMITS, type FeedbackKind } from "@common/bafia/protocol";
import { feedbackProblems } from "../domain/bafia";
import { AppBar } from "../ui/AppBar.tsrx";
import type { GameContext } from "../context";

const KINDS: { kind: FeedbackKind, name: string, hint: string }[] = [
	{ kind: "idea", name: "Идея", hint: "Что добавить или улучшить в игре" },
	{ kind: "bug", name: "Баг", hint: "Что сломалось: где, что нажал, что ожидал и что получилось" },
	{ kind: "suggestion", name: "Предложение", hint: "Любые пожелания и замечания" }
];

/** «Идеи и баги»: игрок пишет администратору Бафии, текст и ник видны только ему */
export function FeedbackScreen({ ctx }: { ctx: GameContext }) @{
	const [kind, setKind] = createSignal<FeedbackKind>("idea");
	const [text, setText] = createSignal("");
	const [busy, setBusy] = createSignal(false);
	const [status, setStatus] = createSignal<{ ok: boolean, text: string } | undefined>(undefined);
	const current = () => KINDS.find(entry => entry.kind == kind())!;

	const send = async () => {
		const body = text().trim();
		if(!body || busy()) return;
		setBusy(true);
		setStatus(undefined);
		const result = await ctx.bafia.sendFeedback(kind(), body);
		setBusy(false);
		if("ok" in result) {
			setText("");
			setStatus({ ok: true, text: "Спасибо! Отправлено, администратор увидит это на сайте." });
		} else setStatus({ ok: false, text: feedbackProblems[result.error] });
	};

	<>
		<style>
			.page { display: flex; flex-direction: column; height: 100%; }
			.form { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; color: var(--text-dark); }
			.kinds { display: flex; gap: 6px; }
			.kinds button { flex: 1; padding: 9px 6px; font-size: 14px; border-radius: 10px; opacity: .7; }
			.kinds button.on { opacity: 1; outline: 2px solid var(--accent); }
			.hint { font-size: 13px; opacity: .75; }
			textarea { width: 100%; box-sizing: border-box; min-height: 160px; resize: vertical; padding: 10px 12px; font: inherit; font-size: 15px; border-radius: 12px; }
			.foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12px; opacity: .8; }
			.send { padding: 11px; font-size: 16px; }
			.status { font-size: 14px; }
			.status.ok { color: #2fb44c; }
			.status.fail { color: #e5493a; }
			.note { font-size: 12px; opacity: .65; line-height: 1.35; }
		</style>
		<div class="page">
			<AppBar title="Идеи и баги" onBack={() => ctx.nav.pop()} />
			<div class="form">
				<div class="kinds">
					@for (const entry of KINDS) {
						<button class={kind() == entry.kind ? "on" : ""} onClick={() => setKind(entry.kind)}>{entry.name}</button>
					}
				</div>
				<div class="hint">{current().hint}</div>
				<textarea placeholder="Напиши здесь" maxlength={BAFIA_LIMITS.feedback} value={text()} onInput={(event) => setText(event.currentTarget.value)}></textarea>
				<div class="foot"><span>{text().length + " / " + BAFIA_LIMITS.feedback}</span></div>
				<button class="send" disabled={busy() || !text().trim()} onClick={() => void send()}>{busy() ? "Отправляю…" : "Отправить"}</button>
				@if (status()) {
					<div class={status()!.ok ? "status ok" : "status fail"}>{status()!.text}</div>
				}
				<div class="note">{"Уходят только твой текст и ник в игре, администратор Бафии видит их на своём сайте. Отправлять можно не чаще раза в 20 секунд."}</div>
			</div>
		</div>
	</>
}
