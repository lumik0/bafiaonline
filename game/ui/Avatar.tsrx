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
			.hat { position: absolute; z-index: 1; pointer-events: none; filter: drop-shadow(0 1px 1.5px rgba(0, 0, 0, .45)); }
			.avatar { border-radius: 50%; object-fit: cover; background: var(--accent); display: block; }
		</style>
		<span class="avatar-box">
		<img class="avatar" src={src()} width={size} height={size} alt="" style={ring?.() ? { "box-shadow": ring() } : undefined} onError={() => gifSrc() ? setGifFailed(gif!()!) : setFailed(photo())} />
		@if (animation?.()) {
			<Lottie animation={() => animation!()} inset="-25%" />
		}
		@if (hat?.()) {
			<svg class="hat" viewBox="0 0 120 80" style={{ width: Math.round(size * 0.9) + "px", height: Math.round(size * 0.6) + "px", left: Math.round(-size * 0.28) + "px", top: Math.round(-size * 0.28) + "px" }} aria-hidden="true">
				<defs>
					<linearGradient id="hat-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0443d" /><stop offset="1" stop-color="#b3191a" /></linearGradient>
					<linearGradient id="hat-white" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" /><stop offset="1" stop-color="#d9dde2" /></linearGradient>
				</defs>
				<path d="M104 54 C 112 14 86 -4 58 0 C 32 5 12 24 3 48 C 16 44 30 48 42 60 Z" fill="url(#hat-red)" />
				<path d="M18 30 C 34 14 56 6 78 9 C 92 12 100 24 103 38" fill="none" stroke="#ff8a80" stroke-width="3.2" stroke-linecap="round" opacity=".65" />
				<path d="M30 50 C 40 52 46 56 50 62" fill="none" stroke="#8f1012" stroke-width="2" stroke-linecap="round" opacity=".5" />
				<g transform="rotate(-12 72 54)"><rect x="30" y="44" width="86" height="24" rx="12" fill="url(#hat-white)" /><path d="M42 50 Q 74 46 108 50" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".9" /></g>
			</svg>
		}
		</span>
	</>
}
