export interface ForegroundDeps {
  /** документ: события `visibilitychange` и `visibilityState` */
  document: EventTarget & { visibilityState?: string }
  /** окно: событие `pageshow` (Safari возвращает страницу из памяти уже с мёртвым сокетом) */
  window?: EventTarget
  /** идёт ли игра в комнате: там тишину заметит монитор связи, а лишний перезаход в игру ни к чему */
  busy: () => boolean
  /** открыть соединение заново */
  reconnect: () => void
  now?: () => number
  /** сколько мс страница должна пробыть в фоне, чтобы не доверять соединению (по умолчанию 20 секунд) */
  minHidden?: number
}

/**
 * на телефоне браузер замораживает сокет, когда вкладка в фоне или экран заблокирован, а после возвращения сокет выглядит
 * открытым, хотя мёртв: пишешь, отправляешь и не видишь ответа, пока не перезайдёшь. Поэтому после долгого фона сразу
 * открываем соединение заново (подписки экранов восстанавливаются сами), а не ждём, пока кто-то заметит тишину
 */
export class ForegroundWatch {
  private hiddenAt?: number;
  private stopped = true;

  constructor(private deps: ForegroundDeps) {}

  private now() { return (this.deps.now ?? Date.now)(); }

  private visibility = () => {
    if(this.deps.document.visibilityState == "hidden") { this.hiddenAt ??= this.now(); return; }
    this.check();
  };

  private pageShow = (event: Event) => {
    // страница вернулась из памяти (bfcache): сколько она была в фоне, неизвестно, считаем долго
    if((event as { persisted?: boolean }).persisted) this.hiddenAt = this.now() - (this.deps.minHidden ?? 20_000);
    this.check();
  };

  private check() {
    const { hiddenAt } = this;
    this.hiddenAt = undefined;
    if(hiddenAt === undefined || this.now() - hiddenAt < (this.deps.minHidden ?? 20_000) || this.deps.busy()) return;
    this.deps.reconnect();
  }

  start() {
    if(!this.stopped) return;
    this.stopped = false;
    this.deps.document.addEventListener("visibilitychange", this.visibility);
    this.deps.window?.addEventListener("pageshow", this.pageShow);
  }

  stop() {
    this.stopped = true;
    this.deps.document.removeEventListener("visibilitychange", this.visibility);
    this.deps.window?.removeEventListener("pageshow", this.pageShow);
  }
}
