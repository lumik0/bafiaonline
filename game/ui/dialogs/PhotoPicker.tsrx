import { createSignal, onMount } from "@common/ui";
import { PHOTO_BASE } from "@common/constants";
import { fileToJpegBase64 } from "../../domain/photo";
import type { GameContext } from "../../context";

/** фото профиля: загрузить своё, удалить или выбрать из стандартных */
export function PhotoPicker({ ctx, close }: { ctx: GameContext, close: () => void }) @{
	const [photos, setPhotos] = createSignal<string[]>([]);
	const [busy, setBusy] = createSignal(false);

	onMount(async () => {
		try {
			setPhotos(await ctx.profile.defaultPhotos());
		} catch {}
	});

	/** любая операция блокирует кнопки, пока идёт, и показывает ошибку, если не вышло */
	const run = async (action: () => Promise<void>) => {
		if(busy()) return;
		setBusy(true);
		try {
			await action();
		} catch(error) {
			await ctx.dialogs.alert(error instanceof Error ? error.message : String(error), { title: "Ошибка" });
		} finally {
			setBusy(false);
		}
	};

	const upload = () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/png, image/jpeg";
		input.onchange = () => {
			const file = input.files?.[0];
			if(!file) return;
			void run(async () => {
				const result = await ctx.profile.uploadPhoto(await fileToJpegBase64(file));
				if(result == "wrongType") await ctx.dialogs.alert("Допустимы только PNG и JPG");
				else close();
			});
		};
		input.click();
	};

	const remove = () => void run(async () => {
		if(!await ctx.dialogs.confirm("Ты уверен, что хочешь удалить фото профиля?", { yes: "Удалить" })) return;
		await ctx.profile.removePhoto();
		close();
	});

	const choose = (id: string) => void run(async () => {
		await ctx.profile.chooseDefaultPhoto(id);
		close();
	});

	<>
		<style>
			.actions { display: flex; gap: 8px; margin-bottom: 10px; }
			.actions button { flex: 1; }
			.or { font-size: 13px; margin: 6px 0; }
			.grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; max-height: 180px; overflow-y: auto; padding: 6px; border-radius: 10px; background: rgba(0, 0, 0, .25); }
			.grid img { width: 52px; height: 52px; border-radius: 50%; cursor: pointer; transition: transform .12s; }
			.grid img:hover { transform: scale(1.12); }
			.empty { padding: 20px; opacity: .7; font-size: 13px; }
		</style>
		<div class="actions">
			<button disabled={busy()} onClick={remove}>{"Удалить фото"}</button>
			<button disabled={busy()} onClick={upload}>{"Загрузить своё"}</button>
		</div>
		<div class="or">{"или выбери из списка:"}</div>
		<div class="grid">
			@for (const id of photos()) {
				<img src={PHOTO_BASE + "/default/" + id + ".jpg"} alt={id} onClick={() => choose(id)} />
			} @empty {
				<div class="empty">{"Загрузка…"}</div>
			}
		</div>
	</>
}
