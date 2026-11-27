import { createSignal, onCleanup, onMount } from "@common/ui";
import { isIOS } from "@common/utils/mobile";

/** открыта ли на iPhone клавиатура (на Android панели не сжимаются: перестройка экрана при каждом открытии мерцала и тормозила): фокус в поле ввода или видимая область заметно ниже окна (iOS не меняет высоту окна, поэтому смотрим на `visualViewport`) */
export function useKeyboardOpen(): () => boolean {
  const [open, setOpen] = createSignal(false);
  onMount(() => {
    if(!isIOS()) return;
    const viewport = window.visualViewport;
    const textField = () => {
      const active = document.activeElement;
      return active instanceof HTMLInputElement && ["text", "search", ""].includes(active.type) || active instanceof HTMLTextAreaElement;
    };
    const update = () => setOpen(textField() || (viewport ? window.innerHeight - viewport.height > 150 : false));
    const later = () => setTimeout(update, 0);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", later);
    viewport?.addEventListener("resize", update);
    onCleanup(() => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", later);
      viewport?.removeEventListener("resize", update);
    });
  });
  return open;
}
