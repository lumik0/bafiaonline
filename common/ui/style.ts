const styles = new Map<string, HTMLStyleElement>();

/** подключает CSS модуля; повторный вызов с тем же id заменяет стиль */
export function injectStyle(id: string, css: string) {
  let element = styles.get(id);
  if(!element) {
    element = document.createElement("style");
    element.dataset.module = id;
    document.head.appendChild(element);
    styles.set(id, element);
  }
  element.textContent = css;
}
