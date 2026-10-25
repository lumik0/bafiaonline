export function Message({ text, buttons, choose }: { text: string, buttons: string[], choose: (index: number) => void }) @{
	const items = buttons.map((label, index) => ({ label, index }));

	<>
		<style>
			.message { display: flex; flex-direction: column; gap: 14px; padding: 16px; height: 100%; box-sizing: border-box; }
			.text { flex: 1; white-space: pre-wrap; font-size: 14px; line-height: 1.4; overflow: auto; user-select: text; -webkit-user-select: text; }
			.buttons { display: flex; gap: 8px; justify-content: flex-end; }
		</style>
		<div class="message">
			<div class="text">{text}</div>
			<div class="buttons">
				@for (const item of items) {
					<button onClick={() => choose(item.index)}>{item.label}</button>
				}
			</div>
		</div>
	</>
}
