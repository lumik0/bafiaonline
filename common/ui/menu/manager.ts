import Events from "../../utils/emitter";

export interface OpenMenu {
  items: readonly string[]
  /** где открыть: координаты курсора на экране (clientX/clientY) */
  x: number
  y: number
  close(index?: number): void
}

/** контекстное меню у курсора (правая кнопка мыши). Рисует MenuLayer; одновременно открыто одно */
export class ContextMenuManager extends Events<{ change: () => void }> {
  current?: OpenMenu;

  get isOpen() { return !!this.current; }

  /** индекс выбранного пункта или `undefined`, если меню закрыли */
  open(items: readonly string[], position: { x: number, y: number }): Promise<number | undefined> {
    this.current?.close();
    return new Promise(resolve => {
      const menu: OpenMenu = {
        items, ...position,
        close: index => {
          if(this.current !== menu) return;
          this.current = undefined;
          this.emit("change");
          resolve(index);
        }
      };
      this.current = menu;
      this.emit("change");
    });
  }

  close() { this.current?.close(); }
}
