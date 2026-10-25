export interface Bounds { x: number, y: number, width: number, height: number }
export interface Size { width: number, height: number }

export type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** сколько заголовка окна всегда должно оставаться на экране, чтобы окно можно было вернуть */
const GRAB = 80;

/** окно нельзя утащить так, чтобы за него нельзя было ухватиться */
export function clampPosition(bounds: Bounds, viewport: Size): Pick<Bounds, "x" | "y"> {
  return {
    x: Math.min(Math.max(bounds.x, GRAB - bounds.width), viewport.width - GRAB),
    y: Math.min(Math.max(bounds.y, 0), viewport.height - 30)
  };
}

/**
 * размеры при растягивании за край/угол. Противоположный край остаётся на месте:
 * достигнув минимума, окно перестаёт и расти, и сдвигаться
 */
export function resizeBounds(start: Bounds, direction: ResizeDirection, dx: number, dy: number, min: Size): Bounds {
  let { x, y, width, height } = start;

  if(direction.includes("e")) width = Math.max(min.width, start.width + dx);
  if(direction.includes("s")) height = Math.max(min.height, start.height + dy);
  if(direction.includes("w")) {
    width = Math.max(min.width, start.width - dx);
    x = start.x + start.width - width;
  }
  if(direction.includes("n")) {
    height = Math.max(min.height, start.height - dy);
    y = start.y + start.height - height;
  }
  return { x, y, width, height };
}
