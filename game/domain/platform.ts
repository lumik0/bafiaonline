import type { Platform } from "@common/bafia/protocol";

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
