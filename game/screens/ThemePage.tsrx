import { createSignal } from "@common/ui";
import { ThemeEditor } from "@common/ui/theme/ThemeEditor.tsrx";
import { DEMO_NAME, demoEntries } from "../domain/chat/demo";
import { AppBar } from "../ui/AppBar.tsrx";
import { ChatView } from "../ui/ChatView.tsrx";
import type { GameContext } from "../context";

/** редактор оформления; над ним - пример переписки, где сразу видно, как выглядят выбранные цвета */
export function ThemePage({ ctx }: { ctx: GameContext }) @{
	const [demo, setDemo] = createSignal(true);
	const entries = demoEntries();

	<>
		<style>
			.page { display: flex; flex-direction: column; height: 100%; }
			.body { flex: 1; overflow-y: auto; }
			.toggle { display: flex; align-items: center; gap: 8px; padding: 10px 14px 0; font-size: 14px; }
			.toggle input { zoom: 1.4; }
			.demo { height: 340px; margin: 6px 0; }
		</style>
		<div class="page">
			<AppBar title="Оформление" onBack={() => ctx.nav.pop()} />
			<div class="body">
				<label class="toggle"><input type="checkbox" checked={demo()} onChange={(event) => setDemo(event.currentTarget.checked)} />{"Показать пример сообщений"}</label>
				@if (demo()) {
					<div class="demo">
						<ChatView ctx={ctx} entries={() => entries} myName={() => DEMO_NAME} hideName={() => false} assets={ctx.assets} send={() => {}} readonly={true} />
					</div>
				}
				<ThemeEditor theme={ctx.theme} assets={ctx.assets} dialogs={ctx.dialogs} />
			</div>
		</div>
	</>
}
