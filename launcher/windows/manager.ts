import Events from "@common/utils/emitter";
import { clampPosition, resizeBounds, type Bounds, type ResizeDirection, type Size } from "./geometry";

export type WindowMode = "normal" | "minimized" | "maximized";

export interface WindowOptions {
  title?: string
  /** эмодзи или https-адрес картинки */
  icon?: string
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
  x?: number
  y?: number
  center?: boolean
  resizable?: boolean
  movable?: boolean
  titleBar?: boolean
  closable?: boolean
  minimizable?: boolean
  maximizable?: boolean
  alwaysOnTop?: boolean
  /** масштаб содержимого (CSS zoom) */
  zoom?: number
  /** небольшое окно-диалог: на телефоне не растягивается и не попадает в док */
  popup?: boolean
  /** открыть на весь экран (как на телефоне) */
  fullscreen?: boolean
}

export type WindowEvents = {
  /** любое изменение вида или положения окна */
  change: () => void
  /** можно отменить: `event.isCancelled = true` */
  beforeClose: (event: { isCancelled: boolean }) => void
  close: () => void
};

let nextId = 1;

export class WindowHandle extends Events<WindowEvents> {
  readonly id = nextId++;
  readonly options: Required<Omit<WindowOptions, "x" | "y" | "center" | "icon" | "title" | "fullscreen">> & Pick<WindowOptions, "icon"> & { fullscreen: boolean };

  title: string;
  icon: string;
  bounds: Bounds;
  mode: WindowMode = "normal";
  locked = false;
  closing = false;
  alive = true;
  /** положение до разворачивания на весь экран */
  restoreBounds?: Bounds;

  private contentElement?: HTMLElement;

  constructor(readonly manager: WindowManager, options: WindowOptions, bounds: Bounds, readonly fullscreen: boolean) {
    super();
    this.title = options.title ?? "Окно";
    this.icon = options.icon ?? "";
    this.bounds = bounds;
    this.options = {
      icon: options.icon,
      width: bounds.width,
      height: bounds.height,
      minWidth: options.minWidth ?? 120,
      minHeight: options.minHeight ?? 100,
      resizable: !fullscreen && (options.resizable ?? true),
      movable: !fullscreen && (options.movable ?? true),
      titleBar: !fullscreen && (options.titleBar ?? true),
      closable: options.closable ?? true,
      minimizable: options.minimizable ?? true,
      maximizable: !fullscreen && (options.maximizable ?? true),
      alwaysOnTop: options.alwaysOnTop ?? false,
      zoom: options.zoom ?? 1,
      popup: options.popup ?? false,
      fullscreen
    };
    if(fullscreen) this.mode = "maximized";
  }

  /** сюда окно (например, игра) рисует своё содержимое */
  get content(): HTMLElement {
    if(!this.contentElement) {
      this.contentElement = document.createElement("div");
      // заполняет окно: без явной высоты экраны с height: 100% схлопываются в ноль
      this.contentElement.style.cssText = "position: relative; width: 100%; height: 100%;";
    }
    return this.contentElement;
  }

  get active() { return this.manager.active === this; }
  get minimized() { return this.mode == "minimized"; }
  get maximized() { return this.mode == "maximized"; }
  get showInDock() { return !this.options.popup; }
  get minSize(): Size { return { width: this.options.minWidth, height: this.options.minHeight }; }

  setTitle(title: string) { this.title = title; this.changed(); }

  focus() { this.manager.focus(this); }
  minimize() { this.manager.minimize(this); }
  restore() { this.manager.restore(this); }
  toggleMaximize() { this.manager.toggleMaximize(this); }
  close(force = false) { return this.manager.close(this, force); }

  lock() { if(!this.locked) { this.locked = true; this.changed(); } }
  unlock() { if(this.locked) { this.locked = false; this.changed(); } }

  move(x: number, y: number) {
    if(!this.options.movable || this.maximized) return;
    this.setBounds({ ...this.bounds, ...clampPosition({ ...this.bounds, x, y }, this.manager.viewport()) });
  }

  /** растягивание из положения `start` на dx/dy от точки, где началось перетаскивание */
  resize(start: Bounds, direction: ResizeDirection, dx: number, dy: number) {
    if(!this.options.resizable || this.maximized) return;
    this.setBounds(resizeBounds(start, direction, dx, dy, this.minSize));
  }

  setBounds(bounds: Bounds) {
    const old = this.bounds;
    if(old.x == bounds.x && old.y == bounds.y && old.width == bounds.width && old.height == bounds.height) return;
    this.bounds = bounds;
    this.changed();
  }

  changed() { this.emit("change"); this.manager.emit("change"); }
}

export type WindowManagerEvents = {
  open: (window: WindowHandle) => void
  close: (window: WindowHandle) => void
  /** список окон, порядок, активное окно или режим изменились */
  change: () => void
};

export interface WindowManagerOptions {
  /** размер рабочего стола в единицах интерфейса; по умолчанию размер страницы, делённый на масштаб */
  viewport?: () => Size
  /** во сколько раз увеличен интерфейс (как масштаб страницы в браузере) */
  scale?: number
  /** сколько места снизу занято доком: новые окна не заходят под него */
  reserveBottom?: () => number
  /** на телефоне окна открываются на весь экран */
  mobile?: boolean
  /** пауза перед удалением закрытого окна: за это время играет анимация */
  closeDelay?: number
}

export class WindowManager extends Events<WindowManagerEvents> {
  /** в порядке открытия; от фокуса не меняется, иначе перезапустятся CSS-анимации */
  private list: WindowHandle[] = [];
  /** от заднего окна к переднему: только для z-index и «активного» окна */
  private stack: WindowHandle[] = [];
  private cascade = 0;

  /** масштаб интерфейса; координаты окон считаются в увеличенных единицах */
  scale: number;

  constructor(private options: WindowManagerOptions = {}) {
    super();
    this.scale = options.scale ?? 1;
  }

  setScale(scale: number) {
    if(scale == this.scale) return;
    this.scale = scale;
    this.viewportChanged();
    this.emit("change");
  }

  viewport(): Size {
    return this.options.viewport?.() ?? { width: window.innerWidth / this.scale, height: window.innerHeight / this.scale };
  }

  get windows(): readonly WindowHandle[] { return this.list; }

  /** окно, на которое смотрит игрок: верхнее из не свёрнутых */
  get active(): WindowHandle | undefined {
    return [...this.stack].reverse().find(window => !window.minimized && !window.closing && !window.options.alwaysOnTop);
  }

  /** док прячется, когда окно развёрнуто на весь экран */
  get hasMaximized() { return this.list.some(window => window.maximized && !window.minimized); }

  zIndex(window: WindowHandle) { return this.stack.indexOf(window) + (window.options.alwaysOnTop ? 1000 : 0); }

  open(options: WindowOptions = {}): WindowHandle {
    const viewport = this.viewport();
    const fullscreen = (!!this.options.mobile || !!options.fullscreen) && !options.popup;
    // обычное окно открывается в рабочей области над доком; развёрнутое и так прячет док
    const area = { width: viewport.width, height: viewport.height - (fullscreen ? 0 : this.options.reserveBottom?.() ?? 0) };
    const width = Math.min(options.width ?? 500, area.width);
    const height = Math.min(options.height ?? 400, area.height);

    let x = options.x ?? 40 + (this.cascade % 8) * 28;
    let y = options.y ?? 40 + (this.cascade % 8) * 28;
    if(options.center) {
      x = (area.width - width) / 2;
      y = (area.height - height) / 2;
    }
    if(options.x === undefined && !options.center) this.cascade++;

    const bounds = fullscreen ? { x: 0, y: 0, ...viewport } : { x, y, width, height };
    const window = new WindowHandle(this, options, bounds, fullscreen);

    this.list = [...this.list, window];
    this.stack.push(window);
    this.emit("open", window);
    this.emit("change");
    return window;
  }

  focus(window: WindowHandle) {
    if(!window.alive || window.closing) return;
    const wasMinimized = window.minimized;
    if(wasMinimized) window.mode = window.restoreBounds || window.fullscreen ? "maximized" : "normal";

    if(this.stack.at(-1) !== window || wasMinimized) {
      this.stack = [...this.stack.filter(other => other !== window), window];
    }
    window.changed();
    this.emit("change");
  }

  minimize(window: WindowHandle) {
    if(!window.options.minimizable || window.minimized) return;
    // развёрнутое окно после сворачивания остаётся «развёрнутым»: restoreBounds хранит прежний размер
    window.mode = "minimized";
    window.changed();
    this.emit("change");
  }

  restore(window: WindowHandle) {
    this.focus(window);
  }

  toggleMaximize(window: WindowHandle) {
    if(!window.options.maximizable) return;

    if(window.restoreBounds) {
      window.mode = "normal";
      window.bounds = window.restoreBounds;
      window.restoreBounds = undefined;
    } else {
      window.restoreBounds = window.bounds;
      window.mode = "maximized";
      window.bounds = { x: 0, y: 0, ...this.viewport() };
    }
    this.focus(window);
  }

  async close(window: WindowHandle, force = false): Promise<boolean> {
    if(!window.alive || window.closing) return false;

    const event = { isCancelled: false };
    await window.call("beforeClose", event);
    if(event.isCancelled && !force) return false;

    window.closing = true;
    window.changed();

    const finish = () => {
      window.alive = false;
      this.list = this.list.filter(other => other !== window);
      this.stack = this.stack.filter(other => other !== window);
      window.emit("close");
      this.emit("close", window);
      window.removeAllListeners();
      this.emit("change");
    };
    const delay = this.options.closeDelay ?? 200;
    if(delay > 0) setTimeout(finish, delay);
    else finish();
    return true;
  }

  /** вызывать при изменении размера страницы: окна остаются в пределах экрана */
  viewportChanged() {
    const viewport = this.viewport();
    for(const window of this.list) {
      if(window.maximized) window.setBounds({ x: 0, y: 0, ...viewport });
      else window.setBounds({ ...window.bounds, ...clampPosition(window.bounds, viewport) });
    }
  }
}
