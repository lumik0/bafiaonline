/** нажатие на ник и карточку не уводит фокус из поля сообщения: клавиатура не сворачивается, пока пишешь (вызывать из `onMouseDown`/`onPointerDown`) */
export function keepFocus(event: Event) {
  const active = document.activeElement;
  if(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) event.preventDefault();
}
