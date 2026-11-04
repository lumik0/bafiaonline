import { expect, test } from "bun:test";
import { detectBrowser, detectPlatform, detectSite } from "./platform";

test("платформа по браузеру: iOS (в том числе iPad под видом Mac), Android раньше Linux, остальное по системе", () => {
  const ua = (userAgent: string, extra: object = {}) => detectPlatform({ userAgent, ...extra });
  expect(ua("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", { platform: "iPhone" })).toBe("ios");
  expect(ua("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", { platform: "MacIntel", maxTouchPoints: 5 })).toBe("ios");
  expect(ua("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", { platform: "MacIntel", maxTouchPoints: 0 })).toBe("macos");
  expect(ua("Mozilla/5.0 (Linux; Android 14; Pixel 8)", { platform: "Linux armv8l" })).toBe("android");
  expect(ua("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", { platform: "Win32" })).toBe("windows");
  expect(ua("Mozilla/5.0 (X11; Linux x86_64)", { platform: "Linux x86_64" })).toBe("linux");
  expect(ua("Mozilla/5.0", { userAgentData: { platform: "Windows" } })).toBe("windows");
  expect(ua("что-то странное")).toBe("other");
});

test("браузер: Edge, Opera, Яндекс и Samsung раньше Chrome, Safari только без Chrome", () => {
  expect(detectBrowser("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 Safari/537.36 Edg/120")).toBe("edge");
  expect(detectBrowser("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 Safari/537.36 OPR/105")).toBe("opera");
  expect(detectBrowser("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 YaBrowser/24 Safari/537.36")).toBe("yandex");
  expect(detectBrowser("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/23 Chrome/115 Mobile Safari/537.36")).toBe("samsung");
  expect(detectBrowser("Mozilla/5.0 (Windows NT 10.0; rv:121.0) Gecko/20100101 Firefox/121.0")).toBe("firefox");
  expect(detectBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 CriOS/120 Mobile Safari/604")).toBe("chrome");
  expect(detectBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Version/17 Mobile Safari/604")).toBe("safari");
  expect(detectBrowser("curl/8")).toBe("other");
});

test("ссылка: только хост, мусор отбрасывается", () => {
  expect(detectSite({ host: "Lumik0.github.io" })).toBe("lumik0.github.io");
  expect(detectSite({ host: "localhost:8080" })).toBe("localhost:8080");
  expect(detectSite({ host: "" })).toBeUndefined();
  expect(detectSite({ host: "a b" })).toBeUndefined();
});
