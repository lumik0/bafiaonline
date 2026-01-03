export function isMobile(){
    return window.navigator.maxTouchPoints || 'ontouchstart' in document;
}