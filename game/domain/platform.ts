import type { Browser, Platform } from "@common/bafia/protocol";

/** с какого устройства играет игрок: только грубая платформа, для статистики сервера Бафии */
export function detectPlatform(nav: { userAgent?: string, platform?: string, maxTouchPoints?: number, userAgentData?: { platform?: string } } = navigator): Platform {
  const agent = nav.userAgent ?? "", hint = nav.userAgentData?.platform ?? nav.platform ?? "";
  if(/android/i.test(agent) || /android/i.test(hint)) return "android";
  // iPad на iOS 13+ выдаёт себя за Mac, но у него есть сенсорный экран
  if(/iphone|ipad|ipod/i.test(agent) || /iphone|ipad|ipod/i.test(hint) || (/mac/i.test(hint + agent) && (nav.maxTouchPoints ?? 0) > 1)) return "ios";
  if(/win/i.test(hint) || /windows/i.test(agent)) return "windows";
  if(/mac/i.test(hint) || /macintosh|mac os/i.test(agent)) return "macos";
  if(/linux|x11/i.test(hint) || /linux|x11/i.test(agent)) return "linux";
  return "other";
}

/** в каком браузере играет игрок; порядок важен: Edge, Opera, Yandex и Samsung тоже называют себя Chrome */
export function detectBrowser(agent: string = navigator.userAgent): Browser {
  if(/edg(e|a|ios)?\//i.test(agent)) return "edge";
  if(/opr\/|opera|opios/i.test(agent)) return "opera";
  if(/yabrowser/i.test(agent)) return "yandex";
  if(/samsungbrowser/i.test(agent)) return "samsung";
  if(/firefox|fxios/i.test(agent)) return "firefox";
  if(/chrome|chromium|crios/i.test(agent)) return "chrome";
  if(/safari/i.test(agent)) return "safari";
  return "other";
}

/** адрес сайта, с которого открыта игра (хост без пути), например "lumik0.github.io" */
export function detectSite(location: { host?: string } = globalThis.location): string | undefined {
  const host = location?.host?.toLowerCase();
  return host && /^[a-z0-9]([a-z0-9.-]{0,58}[a-z0-9])?(:\d{1,5})?$/.test(host) ? host : undefined;
}
