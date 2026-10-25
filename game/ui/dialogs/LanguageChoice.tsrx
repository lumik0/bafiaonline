import { formatDuration } from "@common/utils/format";
import type { GameContext } from "../../context";

/** язык сервера: от него зависит язык системных сообщений. Менять можно раз в 8 часов */
export function LanguageChoice({ ctx, close }: { ctx: GameContext, close: () => void }) @{
	const choose = async (language: "ru" | "en", name: string) => {
		const result = await ctx.profile.setServerLanguage(language);
		close();
		if(result.status == "ok") await ctx.dialogs.alert(`Язык сервера сохранён\n${name}`);
		else await ctx.dialogs.alert(`Нельзя часто менять язык сервера.\n\nТы сможешь изменить его через ${formatDuration(result.waitSeconds)}`);
	};

	<>
		<style>
			.warning { padding: 8px 10px; border-radius: 6px; border: 1px solid #c33; background: rgba(208, 58, 65, .25); font-size: 13px; line-height: 1.4; margin-bottom: 10px; }
			.buttons { display: flex; flex-direction: column; gap: 6px; }
		</style>
		<div class="warning">{"Внимание! Системой запрещено менять язык сервера часто: смена разрешается каждые 8 часов. Будьте аккуратны в выборе."}</div>
		<div class="buttons">
			<button onClick={() => void choose("ru", "Русский")}>{"Русский"}</button>
			<button onClick={() => void choose("en", "English")}>{"English"}</button>
			<button onClick={() => close()}>{"Отмена"}</button>
		</div>
	</>
}
