import { injectStyle } from "../style";

/**
 * вид iOS поверх темы: цвета остаются из темы, меняются формы, шрифт и отклик на нажатие (светлее и темнее, без волн)
 * включается атрибутом `data-platform="ios"` на корне страницы; компоненты читают переменные с запасным значением
 */
const css = `
:root[data-platform="ios"] {
  --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif;

  --appbar-height: 44px;
  --appbar-padding: 4px 8px;
  --appbar-padding-root: 4px 16px;
  --appbar-shadow: 0 .5px 0 rgba(0, 0, 0, .35);
  --appbar-title-size: 17px;
  --appbar-title-weight: 600;
  --appbar-title-align: center;
  --appbar-icon-padding: 8px;
  --appbar-gap: 2px;

  --dialog-radius: 14px;
  --dialog-shadow: 0 10px 40px rgba(0, 0, 0, .4);
  --dialog-head-bg: transparent;
  --dialog-head-text: var(--text-dark);
  --dialog-head-padding: 20px 20px 0;
  --dialog-head-justify: center;
  --dialog-head-align: center;
  --dialog-title-size: 17px;
  --dialog-title-weight: 600;
  --dialog-body-padding: 10px 20px 20px;

  --menu-radius: 14px;
  --menu-bg: var(--dialog-bg);
  --menu-text: var(--text-dark);
  --menu-item-padding: 12px 18px;
  --menu-item-size: 17px;
  --menu-min-width: 220px;

  --switch-on-track: #34c759;
  --switch-off-track: rgba(120, 120, 128, .32);

  --card-radius: 10px;
  --field-padding: 12px 14px;
  --toolbar-wrap: wrap;
  --toolbar-input-basis: 100%;
  --toolbar-input-padding: 10px 14px;
  --toolbar-button-inline: 12px;
  --toolbar-button-flex: 1 1 auto;

  --window-lights: none;
  --window-radius: 14px;
  --window-title-height: 44px;
  --window-title-size: 17px;
  --window-title-align: center;
  --window-title-padding: 0 16px;
  --window-open: fade-in .2s ease;
}

:where([data-platform="ios"]) .bafia { font-family: var(--font); -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; }
:where([data-platform="ios"]) .bafia button, :where([data-platform="ios"]) .bafia input, :where([data-platform="ios"]) .bafia select, :where([data-platform="ios"]) .bafia textarea { font-family: inherit; }

/* кнопка iOS: без рамки, скруглённая; при нажатии бледнеет, без наведения и волн */
:where([data-platform="ios"]) .bafia button {
  border: none;
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 16px;
  font-weight: 600;
  transition: opacity .15s;
}
:where([data-platform="ios"]) .bafia button:enabled:hover { background-color: var(--button-bg); }
:where([data-platform="ios"]) .bafia button.gray:enabled:hover { background-color: var(--button-gray-bg); }
:where([data-platform="ios"]) .bafia button.dark-gray:enabled:hover { background-color: var(--button-dark-bg); }
:where([data-platform="ios"]) .bafia button:enabled:active { opacity: .55; transform: none; }
:where([data-platform="ios"]) .bafia button:disabled { opacity: .4; }

:where([data-platform="ios"]) .bafia input { border-radius: 10px; }
:where([data-platform="ios"]) .bafia input.underline { border-radius: 0; }
/* поля меньше 16px iOS при вводе приближает страницу: не даём */
:where([data-platform="ios"]) .bafia input, :where([data-platform="ios"]) .bafia textarea { font-size: max(16px, 1em); }

@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
`;

/** включает вид iOS на странице */
export function applyIosPlatform(root: HTMLElement = document.documentElement) {
  root.dataset.platform = "ios";
  injectStyle("platform-ios", css);
}
