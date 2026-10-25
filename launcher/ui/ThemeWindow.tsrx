import { DialogLayer } from "@common/ui/dialog/DialogLayer.tsrx";
import { createDialogs, DialogManager } from "@common/ui/dialog/dialogs";
import { ThemeEditor } from "@common/ui/theme/ThemeEditor.tsrx";
import type { Assets } from "@common/assets";
import type { ThemeManager } from "@common/ui/theme";

/** окно оформления: редактор и слой для его диалогов (название темы, подтверждение удаления) */
export function ThemeWindow({ theme, assets }: { theme: ThemeManager, assets: Assets }) @{
	const dialogs = createDialogs(new DialogManager());

	<>
		<style>
			.root { position: relative; height: 100%; overflow-y: auto; }
		</style>
		<div class="root">
			<ThemeEditor theme={theme} assets={assets} dialogs={dialogs} />
			<DialogLayer manager={dialogs.manager} />
		</div>
	</>
}
