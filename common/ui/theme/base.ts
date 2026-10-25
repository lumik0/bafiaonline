/**
 * общий вид элементов, целиком на токенах темы. Подключается один раз: `injectStyle("base", baseCss)`
 * область действия - внутри `.bafia` (корень игры/окна), чтобы не трогать страницу вокруг
 */
export const baseCss = `
.bafia {
  background: var(--bg);
  color: var(--text);
  font-family: Arial, Helvetica, sans-serif;
  /* копировать нечего почти везде: выделяется только то, что отмечено явно (сообщения, значения профиля, логи, поля ввода) */
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  height: 100%;
}
/* Safari без этого не даёт печатать в полях внутри user-select: none */
.bafia input, .bafia textarea, .bafia select { user-select: text; -webkit-user-select: text; }
.bafia img { -webkit-user-drag: none; user-drag: none; }

.bafia button {
  color: var(--button-text);
  background: var(--button-bg);
  border: 1px solid var(--button-border);
  border-radius: var(--button-radius);
  padding: 6px 20px;
  font-size: 15px;
  outline: none;
  cursor: pointer;
  transition: background-color .15s, transform .15s;
}
.bafia button:enabled:hover { background: var(--button-hover); }
.bafia button:enabled:active { background: var(--button-active); transform: scale(.97); }
.bafia button:disabled { background: var(--button-disabled); cursor: default; }

.bafia button.gray { color: var(--button-gray-text); background: var(--button-gray-bg); border-color: var(--surface-border); }
.bafia button.dark-gray { color: var(--button-dark-text); background: var(--button-dark-bg); }

.bafia input {
  background: var(--input-bg);
  color: var(--input-text);
  border: none;
  outline: none;
  font-size: 16px;
  padding: 2px 10px;
  box-sizing: border-box;
  border-radius: 3px;
}
.bafia input.underline {
  background: transparent;
  color: var(--text);
  border-radius: 0;
  border-bottom: 2px solid var(--input-accent);
}

.bafia .header {
  background: var(--header-bg);
  color: var(--header-text);
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center;
}

.bafia .black { color: var(--text-dark); }
`;
