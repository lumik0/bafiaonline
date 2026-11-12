interface CapacitorGlobal { isNativePlatform?: () => boolean, getPlatform?: () => string }

/** запущено в оболочке приложения (Capacitor), а не в браузере */
export const isNativeApp = () => !!(globalThis as { Capacitor?: CapacitorGlobal }).Capacitor?.isNativePlatform?.();

/** вид и поведение приложения: в оболочке всегда, в браузере - с `?app` в адресе (чтобы смотреть вид без сборки apk) */
export const isAppMode = () => isNativeApp() || (typeof location != "undefined" && new URLSearchParams(location.search).has("app"));

export type AppPlatform = "android" | "ios";

/**
 * вид какой системы показывать: в оболочке - её собственной, в браузере с `?app` - Android, а `?app&platform=ios` показывает вид iOS
 * (чтобы смотреть без сборки)
 */
export function appPlatform(): AppPlatform {
  const native = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor?.getPlatform?.();
  if(native == "ios" || native == "android") return native;
  return typeof location != "undefined" && new URLSearchParams(location.search).get("platform") == "ios" ? "ios" : "android";
}
