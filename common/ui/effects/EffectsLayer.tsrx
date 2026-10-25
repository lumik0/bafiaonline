import { fromEvents } from "@common/ui";
import { isMobile } from "@common/utils/mobile";
import type { ThemeManager } from "@common/ui/theme";
import { Halloween } from "./Halloween.tsrx";

/** эффект выбранной темы поверх всего интерфейса; не перехватывает нажатия */
export function EffectsLayer({ theme }: { theme: ThemeManager }) @{
	const effect = fromEvents(theme, "change", () => theme.effect);

	<>
		@if (effect() == "halloween") {
			<Halloween light={isMobile()} />
		}
	</>
}
