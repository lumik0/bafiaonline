import { createSignal, fromEvents } from "@common/ui";
import type { Assets } from "@common/assets";
import { PHOTO_BASE } from "@common/constants";
import type { DecorationAnimation } from "../domain/decorations";
import { Lottie } from "./Lottie.tsrx";

const DEFAULT = "textures/logo/avatar.jpg";

/** круглый аватар игрока; если фото нет или не загрузилось, стандартный */
export function Avatar({ photo, assets, size = 120, asset, ring, animation, gif }: { photo: () => string, assets: Assets, size?: number, asset?: () => string | undefined, ring?: () => string | undefined, animation?: () => DecorationAnimation | undefined, gif?: () => string | undefined }) @{
	const fallback = fromEvents(assets, "change", () => assets.url(DEFAULT));
	const [failed, setFailed] = createSignal("");
	// gif-аватарка игрока с премиумом Бафии важнее фото; не загрузилась - обычное фото
	const [gifFailed, setGifFailed] = createSignal("");
	const gifSrc = () => { const url = gif?.(); return url && gifFailed() != url ? url : undefined; };
	const own = fromEvents(assets, "change", () => asset?.() ? assets.url(asset()!) : "");
	// картинка роли (Мафия, Бармен…) важнее фото; иначе фото игрока, а если нет - стандартная
	const src = () => asset?.() ? own() : gifSrc() ?? (photo() && failed() != photo() ? `${PHOTO_BASE}/${photo()}` : fallback());

	<>
		<style>
			.avatar-box { position: relative; isolation: isolate; display: block; line-height: 0; }
			.avatar { border-radius: 50%; object-fit: cover; background: var(--accent); display: block; }
		</style>
		<span class="avatar-box">
		<img class="avatar" src={src()} width={size} height={size} alt="" style={ring?.() ? { "box-shadow": ring() } : undefined} onError={() => gifSrc() ? setGifFailed(gif!()!) : setFailed(photo())} />
		@if (animation?.()) {
			<Lottie animation={() => animation!()} inset="-25%" />
		}
		</span>
	</>
}
