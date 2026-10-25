import { createEffect, fromEvents, onCleanup, onMount } from "@common/ui";
import { GlobalChat } from "../domain/chat/global";
import { AppBar } from "../ui/AppBar.tsrx";
import { ChatView, type ChatController } from "../ui/ChatView.tsrx";
import { PlayersPanel } from "../ui/PlayersPanel.tsrx";
import type { GameContext } from "../context";

export function GlobalChatScreen({ ctx }: { ctx: GameContext }) @{
	const chat = new GlobalChat(ctx.client, ctx.settings);
	const controller: ChatController = {};

	const entries = fromEvents(chat, "change", () => chat.entries);
	const users = fromEvents(chat, "change", () => chat.users);
	const bafiaOnline = fromEvents(ctx.bafia, "change", () => ctx.bafia.online);
	const bafiaPremium = fromEvents(ctx.bafia, "change", () => ctx.bafia.premiumOnline);
	createEffect(() => ctx.bafia.watch(users().map(user => ({ id: user.playerObjectId, nick: user.username }))));
	const myName = fromEvents(ctx.user, "change", () => ctx.user.username);
	const hideName = fromEvents(ctx.settings, "change", () => ctx.settings.data.hideUsername);
	const background = fromEvents(ctx.assets, "change", () => ctx.assets.url("textures/backgrounds/day3.png"));

	onMount(() => chat.open());
	onCleanup(() => chat.close());

	const openProfile = (playerObjectId: string) => ctx.openProfile(playerObjectId);

	<>
		<style>
			.page { display: flex; flex-direction: column; height: 100%; background-size: cover; background-position: center; }
		</style>
		<div class="page" style={{ "background-image": background() ? "url(" + background() + ")" : "none" }}>
			<AppBar title="Общий чат" onBack={() => ctx.nav.pop()} />
			<PlayersPanel users={users} myName={myName} hideName={hideName} assets={ctx.assets} mention={(name: string) => controller.mention?.(name)} profile={openProfile} inBafia={(id: string) => bafiaOnline().has(id)} badgeColor={(id: string) => { bafiaPremium(); return ctx.bafia.premiumColor(id); }} />
			<ChatView ctx={ctx} entries={entries} myName={myName} hideName={hideName} assets={ctx.assets} send={(text: string) => { if(!ctx.mods.runCommand(text)) chat.send(text); }} onAvatar={openProfile} controller={controller} bafia={ctx.bafia} />
		</div>
	</>
}
