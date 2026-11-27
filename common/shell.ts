/** номер оболочки приложения: растёт только при смене нативной части (не игры), тогда игрокам предлагают поставить новый apk */
export const SHELL_VERSION = 1;

export const APK_URL = "https://github.com/lumik0/bafiaonline/releases/download/app/bafia.apk";
export const SHELL_RELEASE_URL = "https://api.github.com/repos/lumik0/bafiaonline/releases/tags/app";

/** номер оболочки из версии приложения вида "2.4.13+s1"; у старых сборок его нет - 0 */
export function installedShell(versionName: string | undefined): number {
  const match = /\+s(\d+)$/.exec(versionName ?? "");
  return match ? Number(match[1]) : 0;
}

/** номер оболочки из описания релиза ("Оболочка: 1"); нет строки - `undefined` */
export function releasedShell(notes: string | undefined): number | undefined {
  const match = /Оболочка:\s*(\d+)/.exec(notes ?? "");
  return match ? Number(match[1]) : undefined;
}

/** есть ли в релизе оболочка новее установленной */
export async function shellUpdateAvailable(installed: number, load: () => Promise<string | undefined>): Promise<boolean> {
  try {
    const released = releasedShell(await load());
    return released !== undefined && released > installed;
  } catch {
    return false;
  }
}
