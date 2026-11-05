import { PREMIUM_COLORS, PROFILE_THEMES, type PremiumColor, type ProfileLook } from "@common/bafia/protocol";

/** рамка вокруг ника игрока с премиумом Бафии: контур и лёгкая подсветка его цвета (#RRGGBB) */
export function premiumFrame(color: string | undefined): Record<string, string> {
  return color ? { border: `1.5px solid ${color}`, "border-radius": "7px", padding: "0 5px", background: color + "22" } : {};
}

/** цвет значка игрока (CSS) по названию из его внешнего вида или цвету значка */
export const frameColor = (look: ProfileLook | undefined): string | undefined => look?.frame ? PREMIUM_COLORS[look.frame as PremiumColor] : undefined;

/** рамка аватарки (`box-shadow`) цветом премиума; не задана - `fallback` (рамка от украшений игры) */
export function avatarFrame(look: ProfileLook | undefined, fallback?: string): string | undefined {
  const color = frameColor(look);
  return color ? `0 0 0 3px ${color}, 0 0 8px 2px ${color}88` : fallback;
}

/** эффект ника игрока с премиумом; цвет берётся из цвета значка */
export function nickEffect(look: ProfileLook | undefined, color: string | undefined): Record<string, string> {
  const base = color ?? "#E0A800";
  switch(look?.effect) {
    case "glow": return { "text-shadow": `0 0 4px ${base}, 0 0 10px ${base}` };
    case "gradient": return { background: `linear-gradient(90deg, ${base}, #8e4ec6, ${base})`, "-webkit-background-clip": "text", "background-clip": "text", color: "transparent", "-webkit-text-fill-color": "transparent" };
    case "rainbow": return { background: "linear-gradient(90deg, #e5484d, #f76b15, #e0a800, #30a46c, #3e63dd, #8e4ec6)", "-webkit-background-clip": "text", "background-clip": "text", color: "transparent", "-webkit-text-fill-color": "transparent" };
    default: return {};
  }
}

/** фон готовой темы профиля и цвет текста на нём */
export function themeBackground(look: ProfileLook | undefined): { background: string, text: string } | undefined {
  if(!look?.theme || !Object.hasOwn(PROFILE_THEMES, look.theme)) return undefined;
  const dark = look.theme == "sunset" || look.theme == "candy";
  return { background: PROFILE_THEMES[look.theme], text: dark ? "#121212" : "#f2f2f2" };
}
