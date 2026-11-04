/** метка сборки в адресе скрипта страницы: `play/bin/index.js?v=метка`; её ставит сборка, после каждой публикации она новая */
export function buildToken(page: string): string | undefined {
  return /play\/bin\/index\.js\?v=([A-Za-z0-9]+)/.exec(page)?.[1];
}

export interface UpdateDeps {
  /** метка сборки, с которой запущена эта страница; нет (запуск не с сайта) - проверка выключена */
  current: string | undefined
  /** свежий текст страницы с сайта, мимо кэша */
  fetchPage: () => Promise<string>
  /** на сайте новая версия; вызывается один раз на каждую новую метку */
  onAvailable: (token: string) => void
  /** первая проверка после запуска и период, мс (по умолчанию 30 секунд и 10 минут) */
  firstMs?: number
  intervalMs?: number
  schedule?: (callback: () => void, ms: number) => unknown
  cancel?: (handle: unknown) => void
  now?: () => number
}

/**
 * проверка обновления: сравнивает метку сборки, с которой запущена страница, с меткой на сайте. Вкладка или приложение с экрана
 * «Домой» могут не перезагружаться днями и так и оставаться на старой версии; игрок узнаёт, что вышла новая
 * (только новая версия: у старой в run/ этого кода нет)
 */
export class UpdateWatch {
  private timer?: unknown;
  private first?: unknown;
  private notified?: string;
  private checking = false;
  private lastCheck = -Infinity;

  constructor(private deps: UpdateDeps) {}

  private now() { return (this.deps.now ?? Date.now)(); }

  /** новая метка на сайте, о которой уже сообщили */
  get available() { return this.notified; }

  /** сравнивает метки; сбой сети молча пропускается: проверим в следующий раз */
  async check(): Promise<void> {
    const { current, fetchPage, onAvailable } = this.deps;
    if(!current || this.checking) return;
    this.checking = true;
    this.lastCheck = this.now();
    try {
      const token = buildToken(await fetchPage());
      if(token && token != current && token != this.notified) {
        this.notified = token;
        onAvailable(token);
      }
    } catch {
      // нет сети или сайт недоступен
    } finally {
      this.checking = false;
    }
  }

  /** вернулись на вкладку: если давно не проверяли, проверяем сразу (в фоне таймеры замирают) */
  visible(minGapMs = 120_000) {
    if(this.now() - this.lastCheck >= minGapMs) void this.check();
  }

  start() {
    if(!this.deps.current || this.timer !== undefined) return;
    const schedule = this.deps.schedule ?? ((callback, ms) => setTimeout(callback, ms));
    this.first = schedule(() => void this.check(), this.deps.firstMs ?? 30_000);
    const every = this.deps.intervalMs ?? 600_000;
    const loop = () => { this.timer = schedule(() => { void this.check(); loop(); }, every); };
    loop();
  }

  stop() {
    const cancel = this.deps.cancel ?? (handle => clearTimeout(handle as ReturnType<typeof setTimeout>));
    if(this.first !== undefined) cancel(this.first);
    if(this.timer !== undefined) cancel(this.timer);
    this.first = this.timer = undefined;
  }
}
