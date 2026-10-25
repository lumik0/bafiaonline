import { fromEvents } from "@common/ui";
import { roleNames, Role } from "../../domain/enums";
import type { RoomSession } from "../../domain/room/session";
import type { GameContext } from "../../context";

/** роли комнаты: до игры - какие могут выпасть, в игре - какие выданы и по сколько */
export function RoomRolesDialog({ ctx, session, close }: { ctx: GameContext, session: RoomSession, close: () => void }) @{
	const data = fromEvents(session, "change", () => {
		const state = session.state;
		const counts = state.inGame && state.roleCounts ? Object.entries(state.roleCounts).map(([role, count]) => ({ role: Number(role), count })) : undefined;
		const list = counts ?? state.settings.roles.map(role => ({ role, count: undefined as number | undefined }));
		return { given: !!counts, list: list.filter(item => item.count !== 0).sort((a, b) => a.role - b.role) };
	});
	const images = fromEvents(ctx.assets, "change", () => Object.fromEntries(Object.values(Role).filter((value): value is Role => typeof value == "number").map(role => [role, ctx.assets.url(`textures/roles/${role}.png`)])) as Record<number, string>);

	<>
		<style>
			.text { text-align: center; font-size: 15px; line-height: 1.35; margin: 4px 0 12px; }
			.roles { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
			.role { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 2px 3px 4px; border-radius: 6px; background: rgba(0, 0, 0, .06); font-size: 14px; }
			.role img { width: 50px; height: 70px; object-fit: contain; }
			.buttons { display: flex; justify-content: flex-end; margin-top: 12px; }
		</style>
		<div class="text">{data().given ? "Роли, которые выданы игрокам, и их количество:" : "Роли, которые могут быть выданы игрокам в этой комнате, когда игра начнётся:"}</div>
		<div class="roles">
			@for (const item of data().list) {
				<div class="role" title={roleNames[item.role as Role]}>
					<img src={images()[item.role]} alt={roleNames[item.role as Role]} />
					@if (item.count !== undefined) {
						<span>{item.count}</span>
					}
				</div>
			}
		</div>
		<div class="buttons"><button onClick={() => close()}>{"Закрыть"}</button></div>
	</>
}
