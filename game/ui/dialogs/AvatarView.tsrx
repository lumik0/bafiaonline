import type { Assets } from "@common/assets";
import { PHOTO_BASE } from "@common/constants";
import { fromEvents } from "@common/ui";

/** фото игрока крупно */
export function AvatarView({ photo, assets, gif }: { photo?: string, assets: Assets, gif?: string }) @{
	const fallback = fromEvents(assets, "change", () => assets.url("textures/logo/avatar.jpg"));
	const own = () => photo ? PHOTO_BASE + "/" + photo : fallback();

	<>
		<style>
			img { display: block; width: 100%; border-radius: 8px; }
		</style>
		<img src={gif || own()} alt="" onError={(event) => { const next = event.currentTarget.src == gif ? own() : fallback(); if(event.currentTarget.src != next) event.currentTarget.src = next; }} />
	</>
}
