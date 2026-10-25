export const isMobile = () => navigator.maxTouchPoints > 0 || "ontouchstart" in document;

export const isIOS = () =>
  ["iPad Simulator", "iPhone Simulator", "iPod Simulator", "iPad", "iPhone", "iPod"].includes(navigator.platform)
  // iPad на iOS 13+ выдаёт себя за Mac
  || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
