/** красный значок "играет с Бафией": силуэт зелёного значка друга, закрашенный красным (маска, без фильтров: на iPhone фильтр оставлял чёрный фон) */
export function BafiaIcon({ url, size = 18, title = "Играет с Бафией" }: { url: string, size?: number, title?: string }) @{
	<>
		<style>
			.icon { display: inline-block; flex: none; background: #c4271f; -webkit-mask: var(--mask) center / contain no-repeat; mask: var(--mask) center / contain no-repeat; }
		</style>
		<span class="icon" title={title} role="img" aria-label={title} style={{ width: size + "px", height: size + "px", "--mask": "url(" + url + ")" }}></span>
	</>
}
