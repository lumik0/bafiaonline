import type { Assets } from "@common/assets";
import { PHOTO_BASE } from "@common/constants";
import { fromEvents } from "@common/ui";

/** фото игрока крупно */
export function AvatarView({ photo, assets }: { photo?: string, assets: Assets }) @{
	const fallback = fromEvents(assets, "change", () => assets.url("textures/logo/avatar.jpg"));

	<>
		<style>
			img { display: block; width: 100%; border-radius: 8px; }
		</style>
		<img src={photo ? PHOTO_BASE + "/" + photo : fallback()} alt="" onError={(event) => { event.currentTarget.src = fallback(); }} />
	</>
}
