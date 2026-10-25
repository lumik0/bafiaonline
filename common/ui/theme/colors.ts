export interface ParsedColor {
  /** цвет без прозрачности: #rrggbb */
  hex: string
  /** 0..1 */
  alpha: number
}

const byte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
const hex2 = (value: number) => byte(value).toString(16).padStart(2, "0");

/** разбирает #hex, rgb(), transparent; остальное (hsl и т.п.) - `undefined` */
export function parseColor(value: string): ParsedColor | undefined {
  const text = value.trim().toLowerCase();
  if(text == "transparent") return { hex: "#000000", alpha: 0 };

  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/.exec(text);
  if(short) {
    const [, r, g, b, a] = short;
    return { hex: `#${r}${r}${g}${g}${b}${b}`, alpha: a ? parseInt(a + a, 16) / 255 : 1 };
  }
  const long = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(text);
  if(long) return { hex: "#" + long[1], alpha: long[2] ? parseInt(long[2], 16) / 255 : 1 };

  const rgb = /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/.exec(text);
  if(rgb) {
    const alpha = rgb[4] === undefined ? 1 : rgb[4].endsWith("%") ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
    return { hex: "#" + hex2(+rgb[1]!) + hex2(+rgb[2]!) + hex2(+rgb[3]!), alpha: Math.max(0, Math.min(1, alpha)) };
  }
  return undefined;
}

/** обратно в значение для темы: без прозрачности - #rrggbb, с ней - rgba() */
export function formatColor(hex: string, alpha: number): string {
  const parsed = parseColor(hex);
  if(!parsed) return hex;
  if(alpha >= 0.995) return parsed.hex;
  const r = parseInt(parsed.hex.slice(1, 3), 16), g = parseInt(parsed.hex.slice(3, 5), 16), b = parseInt(parsed.hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.round(Math.max(0, alpha) * 100) / 100})`;
}
