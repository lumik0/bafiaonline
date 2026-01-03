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