import { createSignal, onCleanup, type Accessor, type JSX } from "solid-js";
import { render } from "solid-js/web";
import type Events from "../utils/emitter";
import type { EventCMap } from "../utils/emitter";

// реактивность - Solid. Компоненты пишутся на tsrx, `@if`/`@for` подключают Show/For сами
export { ErrorBoundary, createSignal, createMemo, createEffect, createRoot, createContext, useContext, batch, untrack, onCleanup, onMount, type Accessor, type JSX } from "solid-js";
export { Portal, Dynamic } from "solid-js/web";
export { injectStyle } from "./style";

/** рисует компонент в элемент. Возвращает функцию, которая всё убирает и отписывает */
export function mount(component: () => JSX.Element, element: HTMLElement): () => void {
  return render(component, element);
}

/**
 * значение, которое читается заново при событии: `const level = fromEvents(user, "change", () => user.level)`
 * подписка снимается вместе с компонентом
 */
export function fromEvents<E extends EventCMap, K extends keyof E, T>(source: Events<E>, event: K, read: () => T): Accessor<T> {
  const [value, setValue] = createSignal(read(), { equals: false });
  // обработчик НЕ возвращает значение: в Events результат `false` останавливает остальных подписчиков,
  // а setValue возвращает новое значение (например, false у выключенной настройки)
  const handle = source.on(event, (() => { setValue(() => read()); }) as E[K]);
  onCleanup(() => handle.remove());
  return value;
}
