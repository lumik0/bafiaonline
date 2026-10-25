import { roleNames, type Role } from "../../domain/enums";
import { roleDescriptions } from "../../domain/rules";
import type { GameContext } from "../../context";

/** «Ваша роль»: картинка, название и что эта роль умеет */
export function YourRoleDialog({ ctx, role, close }: { ctx: GameContext, role: Role, close: () => void }) @{
	const image = ctx.assets.url(`textures/roles/${role}.png`);

	<>
		<style>
			.row { display: flex; gap: 12px; }
			.row img { width: 70px; height: 98px; object-fit: contain; flex: none; }
			h3 { margin: 0 0 4px; font-size: 18px; font-weight: 500; }
			p { margin: 0; font-size: 15px; line-height: 1.35; }
			.buttons { display: flex; justify-content: flex-end; margin-top: 12px; }
		</style>
		<div class="row">
			<img src={image} alt="" />
			<div>
				<h3>{roleNames[role]}</h3>
				<p>{roleDescriptions[role]}</p>
			</div>
		</div>
		<div class="buttons"><button onClick={() => close()}>{"Закрыть"}</button></div>
	</>
}
