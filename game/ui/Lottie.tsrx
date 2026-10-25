import { createEffect, onCleanup } from "@common/ui";
import type { AnimationItem } from "lottie-web";
import type { DecorationAnimation } from "../domain/decorations";
import { animationSource } from "./animation-source";

/** анимация украшения под содержимым (z-index -1); родитель: position relative, isolation isolate */
export function Lottie({ animation, inset = "0", onError }: { animation: () => DecorationAnimation | undefined, inset?: string, onError?: (reason: string) => void }) @{
	let box: HTMLDivElement;

	createEffect(() => {
		const spec = animation();
		if(!box || !spec) return;
		let player: AnimationItem | undefined, gone = false;
		onCleanup(() => { gone = true; player?.destroy(); });
		// библиотека тяжёлая и нужна не всем: грузим, когда понадобилась первая анимация
		// сначала файл из образа игры, потом сервер (напрямую из браузера он обычно закрыт CORS)
		const load = async(animation: DecorationAnimation): Promise<unknown> => {
			const local = await animationSource.read?.(animation.path);
			if(local) return JSON.parse(local);
			const response = await fetch(animation.url).catch(() => { throw new Error("файла нет в образе игры, а сервер не отдаёт его браузеру"); });
			if(!response.ok) throw new Error("HTTP " + response.status);
			return response.json();
		};
		const fail = (error: unknown) => {
			const reason = error instanceof Error ? error.message : String(error);
			console.warn("Анимация украшения не загрузилась:", spec.url, reason);
			onError?.(reason);
		};
		Promise.all([
			import("lottie-web/build/player/lottie_light"),
			load(spec)
		]).then(([{ default: lottie }, animationData]) => {
			if(gone) return;
			player = lottie.loadAnimation({ container: box, renderer: "svg", loop: true, autoplay: true, animationData, rendererSettings: { preserveAspectRatio: "xMidYMid meet" } });
			player.setSpeed(spec.speed);
			// оттенок заменяет цвета анимации, как в приложении
			if(spec.color) player.addEventListener("DOMLoaded", () => {
				for(const element of box.querySelectorAll<SVGElement>("path, rect, circle, ellipse")) {
					if(element.getAttribute("fill") && element.getAttribute("fill") != "none") element.setAttribute("fill", spec.color!);
					if(element.getAttribute("stroke")) element.setAttribute("stroke", spec.color!);
				}
			});
		}).catch(fail);
	});

	<>
		<style>
			.lottie { position: absolute; z-index: -1; pointer-events: none; overflow: hidden; }
		</style>
		<div class="lottie" ref={box} style={{ inset, opacity: String(animation()?.alpha ?? 1) }}></div>
	</>
}
