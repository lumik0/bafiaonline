/** рамка вокруг ника игрока с премиумом Бафии: контур и лёгкая подсветка его цвета (#RRGGBB) */
export function premiumFrame(color: string | undefined): Record<string, string> {
  return color ? { border: `1.5px solid ${color}`, "border-radius": "7px", padding: "0 5px", background: color + "22" } : {};
}
