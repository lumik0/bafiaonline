import type { Assets } from "@common/assets";
import type { ChatUser } from "../domain/chat/message";
import { Avatar } from "./Avatar.tsrx";
import { nickStyle, photoRing } from "../domain/decorations";

/** игроки в чате: рамка над сообщениями, ники столбцами; ник - упоминание */
export function PlayersPanel({ users, myName, hideName, assets, mention, profile, inBafia, badgeColor }: {
	users: () => ChatUser[], myName: () => string, hideName: () => boolean, assets: Assets,
	mention: (username: string) => void, profile: (playerObjectId: string) => void
	/** играет ли этот игрок в Бафии (по данным сервера Бафии, если включён) */
	inBafia?: (playerObjectId: string) => boolean,
	/** цвет значка игрока с премиумом; нет - обычный значок */
	badgeColor?: (playerObjectId: string) => string | undefined
}) @{
	<>
		<style>
			.players { flex: none; height: 155px; margin: 10px 10px 0; box-sizing: border-box; overflow: auto; border-radius: 4px; outline: 2px solid rgba(190, 190, 190, .8); background: var(--chat-panel); color: var(--chat-name); display: flex; flex-direction: column; flex-wrap: wrap; align-content: flex-start; }
			.player { display: flex; align-items: center; gap: 6px; padding: 3px 10px 3px 6px; text-align: left; }
			.nick { font-size: 13px; cursor: pointer; white-space: nowrap; }
			.blur { filter: blur(5px); }
			.vip { margin-left: 4px; }
			.bafia { margin-left: 4px; padding: 0 4px; border-radius: 4px; font-size: 10px; font-weight: 700; background: var(--accent); color: var(--header-text); }
		</style>
		<div class="players">
			@for (const user of users()) {
				<div class="player">
					<div onClick={() => profile(user.playerObjectId ?? "")}><Avatar photo={() => user.photo ?? ""} ring={() => photoRing(user.decorations)} assets={assets} size={25} /></div>
					<span class={hideName() && user.username == myName() ? "nick blur" : "nick"} data-keep style={nickStyle(user.decorations)} onClick={() => mention(user.username)}>{user.username}<span class="vip">{user.vip ?? ""}</span>{inBafia?.(user.playerObjectId ?? "") ? <span class="bafia" style={badgeColor?.(user.playerObjectId ?? "") ? { background: badgeColor(user.playerObjectId ?? "") } : undefined} title={badgeColor?.(user.playerObjectId ?? "") ? "Играет в Бафии, премиум" : "Играет в Бафии"}>{"Б"}</span> : null}</span>
				</div>
			}
		</div>
	</>
}
