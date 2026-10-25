/** «Зайти, когда освободится место»: показывает, сколько игроков уже в комнате */
export function WaitDialog({ text, cancel }: { text: () => string, cancel: () => void }) @{
	<>
		<style>
			.wait { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 4px 0; }
			.spinner { width: 30px; height: 30px; border-radius: 50%; border: 4px solid rgba(0, 0, 0, .15); border-top-color: var(--accent); animation: spin .8s linear infinite; }
			@keyframes spin { to { transform: rotate(360deg); } }
		</style>
		<div class="wait">
			<div class="spinner"></div>
			<div>{text()}</div>
			<button onClick={cancel}>{"Отмена"}</button>
		</div>
	</>
}
