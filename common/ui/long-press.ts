/** долгое нажатие пальцем: отменяется, если палец сдвинулся (прокрутка), жест прервали или отпустили */
export function longPress(delay = 600, tolerance = 10) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let startX = 0;
  let startY = 0;

  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  return {
    down(event: PointerEvent, open: () => void) {
      if(event.pointerType != "touch") return;
      cancel();
      startX = event.clientX;
      startY = event.clientY;
      timer = setTimeout(() => {
        timer = undefined;
        open();
      }, delay);
    },
    move(event: PointerEvent) {
      if(timer && Math.hypot(event.clientX - startX, event.clientY - startY) > tolerance) cancel();
    },
    cancel
  };
}
