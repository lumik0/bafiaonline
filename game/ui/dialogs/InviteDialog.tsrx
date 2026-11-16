import { createSignal, onMount } from "@common/ui";
import { Avatar } from "../Avatar.tsrx";
import type { InviteItem } from "../../domain/friends";
import type { GameContext } from "../../context";

/** друзья для приглашения в комнату: у каждого кнопка «Пригласить», после неё пометка «Приглашён» */
export function InviteDialog({ ctx, close }: { ctx: GameContext, close: () => void }) @{
	const [friends, setFriends] = createSignal<InviteItem[] | undefined>(undefined);
	const [failed, setFailed] = createSignal(false);
	const [busy, setBusy] = createSignal("");

	onMount(async () => {
		try {
			setFriends(await ctx.friends.inviteList());
		} catch {
			setFailed(true);
		}
	});

	const invite = async (friend: InviteItem) => {
		if(busy()) return;
		setBusy(friend.playerObjectId);
		try {
			const result = await ctx.friends.invite(friend.playerObjectId);
			if(result == "vip") {
				close();
				await ctx.dialogs.alert("Приглашать друзей в комнату может только игрок с VIP.", { title: "Пригласить" });
				return;
			}
			setFriends(list => list?.map(item => item.playerObjectId == friend.playerObjectId ? { ...item, invited: true } : item));
		} catch {
			await ctx.dialogs.alert("Не получилось отправить приглашение.", { title: "Пригласить" });
		} finally {
			setBusy("");
		}
	};

	<>
		<style>
			.list { display: flex; flex-direction: column; gap: 2px; max-height: 340px; overflow-y: auto; }
			.friend { display: flex; align-items: center; gap: 8px; padding: 4px; border-radius: 6px; }
			.name { flex: 1; min-width: 0; font-size: 14px; overflow-wrap: anywhere; }
			.dot { width: 9px; height: 9px; border-radius: 50%; flex: none; background: #9aa0a6; }
			.dot.on { background: #2fb44c; }
			.done { font-size: 13px; opacity: .7; }
			.empty { padding: 14px; text-align: center; opacity: .7; }
		</style>
		<div class="list">
			@if (failed()) {
				<div class="empty">{"Не получилось загрузить друзей."}</div>
			} @else if (friends() === undefined) {
				<div class="empty">{"Загрузка…"}</div>
			} @else {
				@for (const friend of friends()!) {
					<div class="friend">
						<span class={friend.isOnline ? "dot on" : "dot"} title={friend.isOnline ? "в сети" : "не в сети"}></span>
						<Avatar photo={() => friend.photo ?? ""} assets={ctx.assets} size={30} />
						<span class="name" data-keep>{friend.username}</span>
						@if (friend.invited) {
							<span class="done">{"Приглашён"}</span>
						} @else {
							<button disabled={busy() != ""} onClick={() => void invite(friend)}>{"Пригласить"}</button>
						}
					</div>
				} @empty {
					<div class="empty">{"Друзей пока нет"}</div>
				}
			}
		</div>
	</>
}
