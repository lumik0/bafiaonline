interface CapacitorGlobal { isNativePlatform?: () => boolean }

/** запущено в оболочке приложения (Capacitor), а не в браузере */
export const isNativeApp = () => !!(globalThis as { Capacitor?: CapacitorGlobal }).Capacitor?.isNativePlatform?.();

/** вид и поведение приложения: в оболочке всегда, в браузере - с `?app` в адресе (чтобы смотреть вид без сборки apk) */
export const isAppMode = () => isNativeApp() || (typeof location != "undefined" && new URLSearchParams(location.search).has("app"));
