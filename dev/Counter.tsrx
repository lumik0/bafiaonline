// проверка сборки tsrx + solid + hot reload; удалится на этапе 4d
import { createSignal } from "@common/ui";

export default function Counter({ title }: { title: string }) @{
	const [count, setCount] = createSignal(0);

	<>
		<style>
			.box { padding: 16px; color: #eee; }
			button { padding: 6px 12px; }
		</style>
		<div class="box">
			<h1>{title}</h1>
			<button onClick={() => setCount(count() + 1)}>{`Нажато ${count()}`}</button>
			@if (count() > 2) {
				<p>{"Уже много"}</p>
			} @else {
				<p>{"Пока мало"}</p>
			}
		</div>
	</>
}
