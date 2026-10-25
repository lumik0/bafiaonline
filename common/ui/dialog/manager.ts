import Events from "../../utils/emitter";

export interface DialogOptions<T> {
  title?: string
  /** рисует содержимое; `close(значение)` закрывает окно и возвращает значение вызвавшему */
  render: (close: (value?: T) => void) => unknown
  /** закрыть можно Esc, кликом по затемнению или «назад» (результат `undefined`) */
  dismissable?: boolean
  /** шире обычного (редактор, логи) */
  wide?: boolean
  /** своя максимальная ширина, px (профиль чуть уже, чем «wide»); главнее `wide` */
  width?: number
}

export interface DialogEntry {
  readonly id: number
  readonly title?: string
  readonly dismissable: boolean
  readonly wide: boolean
  readonly width?: number
  readonly render: (close: (value?: unknown) => void) => unknown
  close(value?: unknown): void
}

let nextId = 1;

/** окна поверх экрана; верхнее закрывается первым */
export class DialogManager extends Events<{ change: () => void }> {
  private stack: DialogEntry[] = [];

  get entries(): readonly DialogEntry[] { return this.stack; }
  get isOpen() { return this.stack.length > 0; }

  open<T = void>(options: DialogOptions<T>): Promise<T | undefined> {
    return new Promise(resolve => {
      const entry: DialogEntry = {
        id: nextId++,
        title: options.title,
        dismissable: options.dismissable ?? true,
        wide: options.wide ?? false,
        width: options.width,
        render: options.render as DialogEntry["render"],
        close: value => {
          if(!this.stack.includes(entry)) return;
          this.stack = this.stack.filter(other => other !== entry);
          this.emit("change");
          resolve(value as T | undefined);
        }
      };
      this.stack = [...this.stack, entry];
      this.emit("change");
    });
  }

  /** закрывает верхнее окно, если можно; возвращает, закрылось ли (для «назад») */
  dismissTop(): boolean {
    const top = this.stack.at(-1);
    if(!top) return false;
    if(top.dismissable) top.close(undefined);
    return true;
  }

  closeAll() {
    for(const entry of [...this.stack].reverse()) entry.close(undefined);
  }
}
