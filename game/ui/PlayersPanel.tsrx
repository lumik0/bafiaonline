import type { Assets } from "@common/assets";
import type { ChatUser } from "../domain/chat/message";
import { Avatar } from "./Avatar.tsrx";
import { nickStyle, photoRing } from "../domain/decorations";
import { avatarFrame } from "../domain/premium-style";
import type { Bafia } from "../domain/bafia";
import { Marks } from "./Marks.tsrx";
import { CheckBadge } from "./CheckBadge.tsrx";

/** игроки в чате: рамка над сообщениями, ники столбцами; ник - упоминание */
export function PlayersPanel({ users, myName, hideName, assets, mention, profile, inBafia, badgeColor, avatar, bafia }: {
	users: () => ChatUser[], myName: () => string, hideName: () => boolean, assets: Assets,
	mention: (username: string) => void, profile: (playerObjectId: string) => void
	/** играет ли этот игрок в Бафии (по данным сервера Бафии, если включён) */
	inBafia?: (playerObjectId: string) => boolean,
	/** цвет значка игрока с премиумом; нет - обычный значок */
	badgeColor?: (playerObjectId: string) => string | undefined,
	/** адрес gif-аватарки игрока с премиумом */
	avatar?: (playerObjectId: string) => string | undefined,
	/** сервер Бафии: значки «Позор» и «БАН» */
	bafia?: Bafia
}) @{
	<>
		<style>
			.players { flex: none; height: 155px; margin: 10px 10px 0; box-sizing: border-box; overflow: auto; border-radius: 4px; outline: 2px solid rgba(190, 190, 190, .8); background: var(--chat-panel); color: var(--chat-name); display: flex; flex-direction: column; flex-wrap: wrap; align-content: flex-start; }
			.player { display: flex; align-items: center; gap: 6px; padding: 3px 10px 3px 6px; text-align: left; }
			.nick { font-size: 13px; cursor: pointer; white-space: nowrap; }
			.blur { filter: blur(5px); }
			.vip { margin-left: 4px; }
		</style>
		<div class="players">
			@for (const user of users()) {
				<div class="player">
					<div onClick={() => profile(user.playerObjectId ?? "")}><Avatar photo={() => user.photo ?? ""} gif={() => avatar?.(user.playerObjectId ?? "")} ring={() => avatarFrame(bafia?.look(user.playerObjectId ?? ""), photoRing(user.decorations))} assets={assets} size={25} /></div>
					<span class={hideName() && user.username == myName() ? "nick blur" : "nick"} data-keep style={nickStyle(user.decorations)} onClick={() => mention(user.username)}>{user.username}<span class="vip">{user.vip ?? ""}</span>{inBafia?.(user.playerObjectId ?? "") || bafia?.special(user.username) ? <CheckBadge color={badgeColor?.(user.playerObjectId ?? "") ?? "var(--accent)"} fire={!!bafia?.special(user.username)} title={bafia?.special(user.username) ? bafia.special(user.username)![0]!.toUpperCase() + bafia.special(user.username)!.slice(1) : badgeColor?.(user.playerObjectId ?? "") ? "Играет в Бафии, премиум" : "Играет в Бафии"} /> : null}<Marks bafia={bafia} nick={() => user.username} /></span>
				</div>
			}
		</div>
	</>
}
