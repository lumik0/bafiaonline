export enum EventPriority {
  LOWEST = 0,
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  HIGHEST = 4,
  MONITOR = 5
}

export class EventHandle<T extends (...args: any[]) => void> {
  private keyName?: string;
  constructor(
    public readonly event: string,
    public readonly callback: T,
    private readonly owner: Events<any>,
    private priorityName: EventPriority = EventPriority.NORMAL
  ) {}

  key(name: string): this {
    this.keyName = name;
    return this;
  }
  getKey(): string | undefined {
    return this.keyName;
  }

  priority(priority: EventPriority){
    this.priorityName = priority;
    return this;
  }
  getPriority(): EventPriority{
    return this.priorityName
  }

  remove(): void {
    this.owner["_removeHandle"](this);
  }
}

export type EventCMap = Record<string, (...args: any[]) => any>;

export default class Events<Cust extends EventCMap = {}> {
  private customListeners: { [K in keyof Cust]?: EventHandle<Cust[K]>[] } = {};

  public on<K extends keyof Cust>(
    evt: K,
    callback: Cust[K],
    priority: EventPriority = EventPriority.NORMAL
  ): EventHandle<Cust[K]> {
    const handle = new EventHandle(evt as string, callback, this, priority);

    let arr = this.customListeners[evt];
    if(!arr) {
      arr = [];
      this.customListeners[evt] = arr;
    }

    let i = arr.findIndex(h => h.getPriority() > priority);
    if(i === -1) {
      arr.push(handle);
    } else {
      arr.splice(i, 0, handle);
    }

    return handle;
  }

  public once<K extends keyof Cust>(
    evt: K,
    callback: Cust[K],
    priority: EventPriority = EventPriority.NORMAL
  ): EventHandle<Cust[K]> {
    const wrapper = ((...args: any[]) => {
      callback(...args);
      this.off(evt, wrapper as Cust[K]);
    }) as Cust[K];
    return this.on(evt, wrapper, priority);
  }

  public off<K extends keyof Cust>(evt: K, callback: Cust[K]): boolean {
    const arr = this.customListeners[evt];
    if(!arr) return false;
    const before = arr.length;
    this.customListeners[evt] = arr.filter(h => h.callback !== callback);
    return arr.length < before;
  }

  /**
    * Объект(событие) может измениться
    */
  public async call<K extends keyof Cust>(
    evt: K,
    event: Parameters<Cust[K]>[0] = undefined
  ): Promise<Parameters<Cust[K]>[0]> {
    const arr = this.customListeners[evt];
    if(!arr) return event;

    for(const h of arr) {
      const r = h.callback(event);
      if(r instanceof Promise) await r;
    }

    return event;
  }

  /**
    * Синхронный вызов слушателей (с приоритетом)
    */
  public emit<K extends keyof Cust>(
    evt: K,
    ...args: Parameters<Cust[K]> | []
  ): boolean {
    const arr = this.customListeners[evt];
    if(!arr) return false;

    for(const h of arr) {
      h.callback(...args);
    }

    return arr.length > 0;
  }

  /**
    * Асинхронный вызов слушателей (с приоритетом, собирает результаты)
    */
  public async emitR<K extends keyof Cust>(
    evt: K,
    ...args: Parameters<Cust[K]> | []
  ): Promise<ReturnType<Cust[K]>[]> {
    const arr = this.customListeners[evt];
    if(!arr) return [];

    const results: ReturnType<Cust[K]>[] = [];
    for(const h of arr) {
      const r = h.callback(...args);
      results.push(r instanceof Promise ? await r : r);
    }

    return results;
  }

  async wait<K extends keyof Cust>(type: K, timeout = 10_000_000): Promise<Parameters<Cust[K]> | []> {
    return new Promise<Parameters<Cust[K]> | []>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(type, func as any);
        // reject(new Error(`awaitPacket timeout: ${String(idOrType)} in state=${ConnectionState[state]}`));
      }, timeout);

      const func = (...args: any) => {
        clearTimeout(timer);
        this.off('message', func as any);
        resolve(args);
      };

      // @ts-ignore
      this.on(type, func);
    });
  }

  public removeByKey(key: string): boolean {
    let removed = false;
    for(const evt in this.customListeners) {
      const arr = this.customListeners[evt as keyof Cust];
      if(!arr) continue;
      const before = arr.length;
      this.customListeners[evt as keyof Cust] = arr.filter(h => h.getKey() !== key);
      if(this.customListeners[evt as keyof Cust]!.length < before) removed = true;
      // console.log(this.customListeners[evt as keyof Cust])
    }
    return removed;
  }

  private _removeHandle<K extends keyof Cust>(handle: EventHandle<Cust[K]>) {
    const arr = this.customListeners[handle.event as keyof Cust];
    if(!arr) return;
    this.customListeners[handle.event as keyof Cust] = arr.filter(h => h !== handle);
  }

  public removeAllEvents() {
    this.customListeners = {};
  }
}
