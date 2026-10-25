/** откуда Lottie берёт анимации: образ игры (сервер не отдаёт CORS) */
export const animationSource: { read?: (path: string) => Promise<string | undefined> } = {};
