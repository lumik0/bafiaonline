export function insertAtCaret(element: HTMLInputElement, text: string) {
  // @ts-ignore
  if(document.selection) {
    element.focus();
    // @ts-ignore
    const sel = document.selection.createRange();
    sel.text = text;
    element.focus();
  } else if(element.selectionStart || element.selectionStart === 0) {
    const startPos = element.selectionStart;
    const endPos = element.selectionEnd;
    const scrollTop = element.scrollTop;
    // @ts-ignore
    element.value = element.value.substring(0, startPos) + text + element.value.substring(endPos, element.value.length);
    element.focus();
    element.selectionStart = startPos + text.length;
    element.selectionEnd = startPos + text.length;
    element.scrollTop = scrollTop;
  } else {
    element.value += text;
    element.focus();
  }
}

export function createElement<K extends keyof HTMLElementTagNameMap>(tagName: K, options: {
  className?: string
  id?: string
  text?: string
  html?: string
  type?: string
  checked?: boolean
  value?: string
  width?: number
  height?: number
  css?: CSSStyleDeclaration|object
}, callback: (elem: HTMLElementTagNameMap[K]) => void = () => {}): HTMLElementTagNameMap[K] {
  const elem = document.createElement(tagName);
  if(options.className) elem.className = options.className;
  if(options.id) elem.id = options.id;
  if(options.text) elem.textContent = options.text;
  if(options.html) elem.innerHTML = options.html;
  if(options.type) (elem as HTMLInputElement).type = options.type;
  if(options.checked) (elem as HTMLInputElement).checked = options.checked;
  if(options.value) (elem as HTMLInputElement).value = options.value;
  if(options.width) (elem as HTMLImageElement).width = options.width;
  if(options.height) (elem as HTMLImageElement).height = options.height;
  if(options.css){
    for(const key in options.css){
      // @ts-ignore
      elem.style[key] = options.css[key];
    }
  }

  callback(elem);

  return elem;
}
