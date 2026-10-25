export function MessageContent({ text, buttons, choose }: { text: string, buttons: string[], choose: (index: number) => void }) @{
	const items = buttons.map((label, index) => ({ label, index }));

	<>
		<style>
			.text { white-space: pre-wrap; font-size: 14px; line-height: 1.45; user-select: text; -webkit-user-select: text; padding: 4px 0 14px; }
			.buttons { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
		</style>
		<div class="text">{text}</div>
		<div class="buttons">
			@for (const item of items) {
				<button onClick={() => choose(item.index)}>{item.label}</button>
			}
		</div>
	</>
}
