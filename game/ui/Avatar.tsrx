import { createSignal, fromEvents } from "@common/ui";
import type { Assets } from "@common/assets";
import { PHOTO_BASE } from "@common/constants";
import type { DecorationAnimation } from "../domain/decorations";
import { Lottie } from "./Lottie.tsrx";

const DEFAULT = "textures/logo/avatar.jpg";

/** круглый аватар игрока; если фото нет или не загрузилось, стандартный */
export function Avatar({ photo, assets, size = 120, asset, ring, animation, gif, hat }: { photo: () => string, assets: Assets, size?: number, asset?: () => string | undefined, ring?: () => string | undefined, animation?: () => DecorationAnimation | undefined, gif?: () => string | undefined, /** шапка Деда Мороза (внешний вид с премиумом) */ hat?: () => boolean }) @{
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
			.hat { position: absolute; z-index: 1; pointer-events: none; transform: rotate(-14deg); filter: drop-shadow(0 1px 1.5px rgba(0, 0, 0, .45)); }
			.avatar { border-radius: 50%; object-fit: cover; background: var(--accent); display: block; }
		</style>
		<span class="avatar-box">
		<img class="avatar" src={src()} width={size} height={size} alt="" style={ring?.() ? { "box-shadow": ring() } : undefined} onError={() => gifSrc() ? setGifFailed(gif!()!) : setFailed(photo())} />
		@if (animation?.()) {
			<Lottie animation={() => animation!()} inset="-25%" />
		}
		@if (hat?.()) {
			<svg class="hat" viewBox="0 0 100 84" style={{ width: Math.round(size * 0.78) + "px", height: Math.round(size * 0.66) + "px", left: Math.round(size * 0.08) + "px", top: Math.round(-size * 0.4) + "px" }} aria-hidden="true">
				<path d="M10 66 C 12 30 38 6 64 8 C 80 10 92 24 90 40 C 89 48 86 54 84 66 Z" fill="#d62828" />
				<path d="M22 40 C 30 22 46 12 64 12" fill="none" stroke="#f05a5a" stroke-width="5" stroke-linecap="round" opacity=".6" />
				<rect x="4" y="58" width="92" height="20" rx="10" fill="#ffffff" />
				<circle cx="90" cy="38" r="10" fill="#ffffff" />
			</svg>
		}
		</span>
	</>
}
