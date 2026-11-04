import { createSignal } from "@common/ui";

/** откуда Lottie берёт анимации: образ игры (сервер не отдаёт CORS) */
export const animationSource: { read?: (path: string) => Promise<string | undefined> } = {};

const [off, setOff] = createSignal(false);
/** анимации украшений выключены (экономия ресурсов или «уменьшить движение» в системе): Lottie их не создаёт */
export const animationsOff = off;
export const setAnimationsOff = setOff;
