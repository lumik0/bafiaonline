import { createSignal, onMount } from "@common/ui";
import type { GameContext } from "../context";

// друзья загружаются один раз на минуту для всех ников чата сразу
let cache: { at: number, ids: ReadonlySet<string> } | undefined;
let loading: Promise<ReadonlySet<string>> | undefined;
const TTL = 60_000;

function friendIds(ctx: GameContext): Promise<ReadonlySet<string>> {
  if(cache && Date.now() - cache.at < TTL) return Promise.resolve(cache.ids);
  loading ??= ctx.friends.friends()
    .then(list => { cache = { at: Date.now(), ids: new Set(list.filter(friend => !friend.incoming).map(friend => friend.playerObjectId)) }; return cache.ids; })
    .catch(() => cache?.ids ?? new Set<string>())
    .finally(() => { loading = undefined; });
  return loading;
}

/** зелёный значок друга рядом с ником (тот же, что у комнаты с друзьями) */
export function FriendMark({ ctx, id }: { ctx: GameContext, id: string | undefined }) @{
	const [friend, setFriend] = createSignal(false);
	onMount(() => { if(id) void friendIds(ctx).then(ids => setFriend(ids.has(id))); });
	<>
		<style>
			.friend { width: 14px; height: 14px; margin-left: 4px; vertical-align: -2px; }
		</style>
		{friend() ? <img class="friend" src={ctx.assets.url("textures/ui/4v.png")} alt="" title="Друг" /> : null}
	</>
}
