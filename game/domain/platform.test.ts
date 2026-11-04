import { expect, test } from "bun:test";
import { detectPlatform } from "./platform";

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
