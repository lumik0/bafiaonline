import { ContextMenuManager } from "../menu/manager";
import { ChoiceList } from "./ChoiceList.tsrx";
import { DialogManager } from "./manager";
import { MessageContent } from "./MessageContent.tsrx";
import { PromptContent } from "./PromptContent.tsrx";

export interface MessageOptions {
  title?: string
  ok?: string
}

export interface ConfirmOptions {
  title?: string
  yes?: string
  no?: string
}

export interface PromptOptions {
  title?: string
  text?: string
  initial?: string
  placeholder?: string
  ok?: string
  cancel?: string
  validate?: (value: string) => string | undefined
  /** без этого окно нельзя закрыть, пока не введено значение (например, первый ник) */
  required?: boolean
}

/** привычные окна поверх DialogManager: сообщение, подтверждение, ввод строки */
export function createDialogs(manager: DialogManager, menu = new ContextMenuManager()) {
  return {
    manager,
    /** контекстное меню у курсора; рисует MenuLayer */
    menu,

    /**
     * выбор из списка. Мышью (правая кнопка) - меню у курсора, как в старой версии;
     * пальцем (долгое нажатие) - окно с кнопками: меню под пальцем закрывается самим пальцем
     */
    choose(event: Event | undefined, { title, labels }: { title: string, labels: string[] }): Promise<number | undefined> {
      // решает событие: правая кнопка - меню, палец или вызов без события - окно
      const mouse = event instanceof MouseEvent && (!("pointerType" in event) || event.pointerType == "mouse");
      if(mouse) return menu.open(labels, { x: event.clientX, y: event.clientY });
      return manager.open<number>({ title, render: close => ChoiceList({ labels, choose: (index: number) => close(index) }) });
    },

    async alert(text: string, { title = "Сообщение", ok = "OK" }: MessageOptions = {}): Promise<void> {
      await manager.open<number>({ title, render: close => MessageContent({ text, buttons: [ok], choose: (index: number) => close(index) }) });
    },

    /** true - нажали «да»; закрытие окном или «нет» - false */
    async confirm(text: string, { title = "Подтверждение", yes = "Да", no = "Отмена" }: ConfirmOptions = {}): Promise<boolean> {
      return (await manager.open<number>({ title, render: close => MessageContent({ text, buttons: [yes, no], choose: (index: number) => close(index) }) })) == 0;
    },

    /** введённая строка или `undefined`, если отказались */
    prompt({ title = "Ввод", text, initial, placeholder, ok = "OK", cancel = "Отмена", validate, required }: PromptOptions = {}): Promise<string | undefined> {
      return manager.open<string>({
        title, dismissable: !required,
        render: close => PromptContent({ text, initial, placeholder, ok, cancel: required ? "" : cancel, validate, submit: (value: string | undefined) => close(value) })
      });
    }
  };
}

export type Dialogs = ReturnType<typeof createDialogs>;
export { DialogManager };
