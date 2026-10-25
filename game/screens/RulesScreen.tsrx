import { fromEvents } from "@common/ui";
import { roleNames, Role } from "../domain/enums";
import { mafiaTeam, peacefulTeam, roleDescriptions, rulesText } from "../domain/rules";
import { AppBar } from "../ui/AppBar.tsrx";
import type { GameContext } from "../context";

/** правила: роли обеих команд и ход игры */
export function RulesScreen({ ctx }: { ctx: GameContext }) @{
	const images = fromEvents(ctx.assets, "change", () => Object.fromEntries(Object.values(Role).filter((value): value is Role => typeof value == "number").map(role => [role, ctx.assets.url(`textures/roles/${role}.png`)])) as Record<number, string>);
	const teams = [{ title: "Команда мафии", roles: mafiaTeam }, { title: "Команда мирных жителей", roles: peacefulTeam }];

	<>
		<style>
			.page { display: flex; flex-direction: column; height: 100%; }
			.list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 16px; color: var(--text-dark); }
			h2 { margin: 6px 0 0; text-align: center; font-size: 15px; font-weight: 500; color: var(--text-dark); }
			.card { display: flex; gap: 8px; padding: 8px; border-radius: 8px; background: var(--surface); }
			.card img { width: 50px; height: 70px; object-fit: contain; flex: none; }
			.card h3 { margin: 0 0 2px; font-size: 16px; font-weight: 500; }
			.card p { margin: 0; font-size: 14px; line-height: 1.3; }
			.rules { padding: 10px; border-radius: 8px; background: var(--surface); font-size: 14px; line-height: 1.35; }
			.rules p { margin: 0 0 12px; text-indent: 6px; }
			.rules p:last-child { margin-bottom: 0; }
		</style>
		<div class="page">
			<AppBar title="Правила" onBack={() => ctx.nav.pop()} />
			<div class="list">
				<h2>{"Роли"}</h2>
				@for (const team of teams) {
					<>
						<h2>{team.title}</h2>
						@for (const role of team.roles) {
							<div class="card">
								<img src={images()[role]} alt="" />
								<div>
									<h3>{roleNames[role]}</h3>
									<p>{roleDescriptions[role]}</p>
								</div>
							</div>
						}
					</>
				}
				<h2>{"Правила"}</h2>
				<div class="rules">
					@for (const paragraph of rulesText) {
						<p>{paragraph}</p>
					}
				</div>
			</div>
		</div>
	</>
}
