/** список вариантов кнопками: то же, что контекстное меню, но для пальца */
export function ChoiceList({ labels, choose }: { labels: string[], choose: (index: number) => void }) @{
	const items = labels.map((label, index) => ({ label, index }));

	<>
		<style>
			.list { display: flex; flex-direction: column; gap: 6px; max-height: 340px; overflow-y: auto; }
		</style>
		<div class="list">
			@for (const item of items) {
				<button onClick={() => choose(item.index)}>{item.label}</button>
			}
		</div>
	</>
}
