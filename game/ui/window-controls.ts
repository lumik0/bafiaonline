import { createContext } from "@common/ui";

/** управление окном игры: на телефоне кнопку закрытия рисует шапка экрана */
export interface WindowControls {
  /** нет заголовка окна - кнопку закрытия нужно показать самим */
  showClose: boolean
  close(): void
}

export const WindowControlsContext = createContext<WindowControls | undefined>(undefined);
