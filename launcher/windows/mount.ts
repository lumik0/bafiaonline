import { mount, type JSX } from "@common/ui";
import type { WindowHandle } from "./manager";

/** рисует компонент в окне; когда окно закрывается, всё снимается */
export function mountInWindow(window: WindowHandle, component: () => JSX.Element) {
  const dispose = mount(component, window.content);
  window.on("close", dispose);
}
