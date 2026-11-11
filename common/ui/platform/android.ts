import { injectStyle } from "../style";

/**
 * вид Android (Material 3) поверх темы: цвета остаются из темы, меняются формы, шрифт и отклик на нажатие
 * включается атрибутом `data-platform="android"` на корне страницы; компоненты читают переменные с запасным значением,
 * поэтому в браузере без атрибута всё выглядит по-прежнему
 * `:where()` не добавляет веса: правила компонентов (класс + метка компонента) остаются важнее общих
 */
const css = `
:root[data-platform="android"] {
  --font: Roboto, "Noto Sans", system-ui, sans-serif;

  --appbar-height: 64px;
  --appbar-padding: 8px 12px 8px 4px;
  --appbar-padding-root: 8px 12px 8px 16px;
  --appbar-shadow: none;
  --appbar-title-size: 22px;
  --appbar-title-weight: 400;
  --appbar-icon-padding: 12px;
  --appbar-gap: 4px;

  --dialog-radius: 28px;
  --dialog-shadow: 0 8px 24px rgba(0, 0, 0, .35);
  --dialog-head-bg: transparent;
  --dialog-head-text: var(--text-dark);
  --dialog-head-padding: 22px 24px 0;
  --dialog-title-size: 22px;
  --dialog-title-weight: 400;
  --dialog-body-padding: 14px 24px 24px;

  --menu-radius: 12px;
  --menu-bg: var(--dialog-bg);
  --menu-text: var(--text-dark);
  --menu-item-padding: 13px 18px;
  --menu-item-size: 16px;
  --menu-min-width: 200px;

  --switch-outline: 2px;
  --switch-off-scale: .66;
  --switch-off-track: transparent;
  --switch-off-thumb: rgba(128, 128, 128, .95);

  --card-radius: 16px;
  --field-padding: 18px 16px;
  --toolbar-wrap: wrap;
  --toolbar-input-basis: 100%;
  --toolbar-input-padding: 12px 16px;
  --toolbar-button-inline: 12px;
  --toolbar-button-flex: 1 1 auto;

  --window-lights: none;
  --window-radius: 28px;
  --window-title-height: 52px;
  --window-title-size: 18px;
  --window-title-align: left;
  --window-title-padding: 0 24px;
  --window-open: fade-in .2s ease;
}

:where([data-platform="android"]) .bafia { font-family: var(--font); -webkit-tap-highlight-color: transparent; }
:where([data-platform="android"]) .bafia button, :where([data-platform="android"]) .bafia input, :where([data-platform="android"]) .bafia select, :where([data-platform="android"]) .bafia textarea { font-family: inherit; }

/* кнопка Material: без рамки, скруглённая. Отклик - волна от центра: в фоне «дырка» в 1%, сквозь неё виден цвет нажатия;
   при нажатии дырка крошечная, после отпускания она разрастается на всю кнопку, а цвет плавно возвращается */
:where([data-platform="android"]) .bafia button {
  border: none;
  border-radius: 20px;
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: .1px;
  background-image: radial-gradient(circle, transparent 1%, var(--button-bg) 1%);
  background-position: center;
  background-repeat: no-repeat;
  background-size: 15000%;
  transition: background-size .6s, background-color .6s;
}
/* на сенсорном экране «наведение» залипает после нажатия: цвет не меняем */
:where([data-platform="android"]) .bafia button:enabled:hover { background-color: var(--button-bg); }
:where([data-platform="android"]) .bafia button:enabled:active { background-color: var(--button-active); background-size: 100%; transition: background-size 0s, background-color 0s; transform: none; }
/* серые кнопки полупрозрачные: волна на них дала бы двойной слой, поэтому просто затемнение */
:where([data-platform="android"]) .bafia button.gray, :where([data-platform="android"]) .bafia button.dark-gray { background-image: none; transition: filter .2s; }
:where([data-platform="android"]) .bafia button.gray:enabled:hover, :where([data-platform="android"]) .bafia button.gray:enabled:active { background-color: var(--button-gray-bg); }
:where([data-platform="android"]) .bafia button.dark-gray:enabled:hover, :where([data-platform="android"]) .bafia button.dark-gray:enabled:active { background-color: var(--button-dark-bg); }
:where([data-platform="android"]) .bafia button.gray:enabled:active, :where([data-platform="android"]) .bafia button.dark-gray:enabled:active { filter: brightness(.85); }
:where([data-platform="android"]) .bafia button:disabled { background-image: none; opacity: .5; }

:where([data-platform="android"]) .bafia input { border-radius: 8px; }
:where([data-platform="android"]) .bafia input.underline { border-radius: 0; }

@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
`;

/** включает вид Android на странице */
export function applyAndroidPlatform(root: HTMLElement = document.documentElement) {
  root.dataset.platform = "android";
  injectStyle("platform-android", css);
}
