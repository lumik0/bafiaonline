import { fromEvents } from "@common/ui";
import type { Dialogs } from "@common/ui/dialog/dialogs";
import { imageSlots, type Assets } from "@common/assets";

/** замена картинок игры своими; хранятся в IndexedDB игрока */
export function ImageSlots({ assets, dialogs }: { assets: Assets, dialogs: Dialogs }) @{
	const slots = fromEvents(assets, "change", () => imageSlots.map(slot => ({ ...slot, url: assets.url(slot.path), custom: assets.isCustom(slot.path) })));
	const by = (path: string) => slots().find(slot => slot.path.endsWith(path))!;

	const replace = (path: string) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.onchange = async () => {
			const file = input.files?.[0];
			if(!file) return;
			try {
				await assets.setCustom(path, new Uint8Array(await file.arrayBuffer()), file.type);
			} catch(error) {
				void dialogs.alert(error instanceof Error ? error.message : String(error));
			}
		};
		input.click();
	};

	<>
		<style>
			.big { display: flex; flex-direction: column; align-items: center; gap: 6px; }
			.pair { display: flex; justify-content: space-around; gap: 10px; }
			.slot { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; }
			.title { font-size: 14px; font-weight: 600; opacity: .9; }
			.picture { object-fit: cover; object-position: 8% center; background: var(--surface); border: 1px solid rgba(0, 0, 0, .35); }
			.picture.tall { width: 94px; height: 140px; }
			.picture.wide { width: 190px; height: 280px; max-width: 60vw; }
			.buttons { display: flex; gap: 6px; }
			.buttons button { padding: 6px 12px; font-size: 13px; }
			.buttons .undo { padding: 6px 9px; }
			.avatar { display: flex; align-items: center; justify-content: center; gap: 10px; }
			.avatar img { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
		</style>
		<div class="big">
			<div class="title">{"Фон"}</div>
			<img class="picture wide" src={by("menu3.png").url} alt="" />
			<div class="buttons">
				<button onClick={() => replace(by("menu3.png").path)}>{"Загрузить"}</button>
				<button class="undo" aria-label="Вернуть" disabled={!by("menu3.png").custom} onClick={() => void assets.clearCustom(by("menu3.png").path)}>{"↺"}</button>
			</div>
		</div>
		<div class="pair">
			@for (const item of [{ path: "day3.png", title: "День в чате" }, { path: "night3.png", title: "Ночь в чате" }]) {
				<div class="slot">
					<div class="title">{item.title}</div>
					<img class="picture tall" src={by(item.path).url} alt="" />
					<div class="buttons">
						<button onClick={() => replace(by(item.path).path)}>{"Загрузить"}</button>
						<button class="undo" aria-label="Вернуть" disabled={!by(item.path).custom} onClick={() => void assets.clearCustom(by(item.path).path)}>{"↺"}</button>
					</div>
				</div>
			}
		</div>
		<div class="avatar">
			<img src={by("avatar.jpg").url} alt="" />
			<span class="title">{"Аватар по умолчанию"}</span>
			<div class="buttons">
				<button onClick={() => replace(by("avatar.jpg").path)}>{"Загрузить"}</button>
				<button class="undo" aria-label="Вернуть" disabled={!by("avatar.jpg").custom} onClick={() => void assets.clearCustom(by("avatar.jpg").path)}>{"↺"}</button>
			</div>
		</div>
	</>
}
