import { Message } from "./ui/Message.tsrx";
import type { WindowManager } from "./windows/manager";
import { mountInWindow } from "./windows/mount";

interface DialogOptions {
  title?: string
  text: string
  buttons?: string[]
}

/** окно-вопрос. Возвращает номер нажатой кнопки или -1, если окно закрыли крестиком */
export function ask(manager: WindowManager, { title = "Сообщение", text, buttons = ["OK"] }: DialogOptions): Promise<number> {
  return new Promise(resolve => {
    const lines = text.split("\n").length + Math.floor(text.length / 40);
    const window = manager.open({
      title, popup: true, center: true,
      width: 340, height: Math.min(100 + lines * 20, 420),
      resizable: false, minimizable: false, maximizable: false
    });
    let answer = -1;
    window.on("close", () => resolve(answer));
    mountInWindow(window, () => Message({
      text, buttons,
      choose: (index: number) => { answer = index; void window.close(true); }
    }) as never);
  });
}

export const alert = (manager: WindowManager, text: string, title?: string) => ask(manager, { title, text }).then(() => {});

export const confirm = async(manager: WindowManager, text: string, title = "Подтверждение", yes = "Да", no = "Отмена") =>
  (await ask(manager, { title, text, buttons: [yes, no] })) == 0;
