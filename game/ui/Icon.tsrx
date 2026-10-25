import { icons, type IconName } from "./icons";

export function Icon({ name, color = 'currentColor', size = 20 }: { name: IconName, color?: string, size?: number }) @{
	<svg viewBox="0 0 24 24" width={size} height={size} fill={color} aria-hidden="true">
		<path d={icons[name]} />
	</svg>
}
