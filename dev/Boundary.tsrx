import { ErrorBoundary } from "@common/ui";

// проверка: ошибка при отрисовке попадает в запасной экран, а не роняет всё приложение; на этом построен GameRoot
function Broken() @{
	throw new Error("сломано при отрисовке");
	<div>{"недостижимо"}</div>
}

export default function Boundary({ onCatch }: { onCatch: (error: unknown) => void }) @{
	<>
		<div class="outside">{"снаружи"}</div>
		<ErrorBoundary fallback={(error: unknown) => { onCatch(error); return <div class="fallback">{"запасной экран"}</div>; }}>
			<Broken />
		</ErrorBoundary>
	</>
}
