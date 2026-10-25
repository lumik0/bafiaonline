// Events v2

export enum EventPriority {
  LOWEST  = 0,
  LOW     = 1,
  NORMAL  = 2,
  HIGH    = 3,
  HIGHEST = 4,
  MONITOR = 5
}

// ─── EventHandle ────────────────────────────────────────────────────────────

export class EventHandle<T extends (...args: any[]) => any> {
  private _key?: string;
  private _group?: string;
  private _paused = false;
  /** имя для профайлера: при заданном имени `emit` замеряет время обработчика */
  label?: string;

  constructor(
    public readonly event: string,
    public readonly callback: T,
    private readonly owner: Events<any>,
    private _priority: EventPriority = EventPriority.NORMAL
  ) {}

  // Unique identifier of one handler
  key(name: string): this { this._key = name; return this; }
  getKey(): string | undefined { return this._key; }

  // Group label - one label can be put on N handlers
  group(name: string): this { this._group = name; return this; }
  getGroup(): string | undefined { return this._group; }

  priority(p: EventPriority): this { this._priority = p; return this; }
  getPriority(): EventPriority { return this._priority; }

  // Mute temporarily without removing
  pause(): this  { this._paused = true;  return this; }
  resume(): this { this._paused = false; return this; }
  isPaused(): boolean { return this._paused; }

  remove(): void { this.owner["_removeHandle"](this); }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type EventCMap = Record<string, (...args: any[]) => any>;

export type WaitResult<Cust extends EventCMap, K extends keyof Cust> =
  Parameters<Cust[K]> extends [] ? [] : Parameters<Cust[K]>;

export interface IEvents<Cust extends EventCMap = {}> {
  on<K extends keyof Cust>(evt: K, cb: Cust[K], priority?: EventPriority): EventHandle<Cust[K]>
  once<K extends keyof Cust>(evt: K, cb: Cust[K], priority?: EventPriority): EventHandle<Cust[K]>
  off<K extends keyof Cust>(evt: K, cb: Cust[K]): boolean

  /** Passes one event object down the chain (async, mutable) */
  call<K extends keyof Cust>(evt: K, event?: Parameters<Cust[K]>[0]): Promise<Parameters<Cust[K]>[0]>
  /** Synchronous call. If any handler returns false, it stops (cancelable) */
  emit<K extends keyof Cust>(evt: K, ...args: Parameters<Cust[K]> | []): boolean
  /** Async call, collects all results */
  emitR<K extends keyof Cust>(evt: K, ...args: Parameters<Cust[K]> | []): Promise<ReturnType<Cust[K]>[]>
  /** Synchronous call of all handlers, collects results (doesn't wait for promises) */
  emitSync<K extends keyof Cust>(evt: K, ...args: Parameters<Cust[K]> | []): ReturnType<Cust[K]>[]

  /** Waits for the next event. Rejects on timeout */
  wait<K extends keyof Cust>(evt: K, timeout?: number): Promise<WaitResult<Cust, K>>

  onAny(cb: (evt: string, ...args: any[]) => void): EventHandle<any>

  removeByKey(key: string): boolean
  removeByGroup(group: string): number   // returns how many were removed
  removeAllListeners(evt?: keyof Cust): void

  listenerCount(evt: keyof Cust): number
  // (keyof Cust)[] instead of string[] here would make Events<Cust> invariant in Cust for any
  // caller that still has an unresolved Cust in scope - e.g. Entity<Cust extends EventCMap = {}>
  // methods that do `this.bar(this)` against a plain `Entity` parameter would stop compiling,
  // because TS can no longer treat keyof Cust as freely comparable to keyof {} without Cust
  // being a concrete type. Event names are always plain strings at runtime anyway
  eventNames(): string[]
}

// ─── Implementation ──────────────────────────────────────────────────────────

export default class Events<Cust extends EventCMap = {}> implements IEvents<Cust> {
  private _listeners: { [K in keyof Cust]?: EventHandle<Cust[K]>[] } = {};
  private _anyListeners: EventHandle<any>[] = [];

  // ── Registration ──────────────────────────────────────────────────────────

  on<K extends keyof Cust>(
    evt: K,
    cb: Cust[K],
    priority: EventPriority = EventPriority.NORMAL
  ): EventHandle<Cust[K]> {
    const handle = new EventHandle(evt as string, cb, this, priority);
    this.registered(handle);

    // A new array, never the one in place: emit() walks the array it got without copying it, so a
    // listener added (or removed - those always make a new array too) while it runs doesn't disturb it
    const arr = this._listeners[evt] ?? [];
    // Insert at the right place by priority (descending)
    const i = arr.findIndex(h => h.getPriority() < priority);
    this._listeners[evt] = (i == -1 ? [...arr, handle] : [...arr.slice(0, i), handle, ...arr.slice(i)]) as any;

    return handle;
  }

  once<K extends keyof Cust>(
    evt: K,
    cb: Cust[K],
    priority: EventPriority = EventPriority.NORMAL
  ): EventHandle<Cust[K]> {
    let handle: EventHandle<Cust[K]>;

    const wrapper = ((...args: any[]) => {
      handle.remove();        // remove by handle, not by wrapper - this fixes an old bug
      return cb(...args);
    }) as Cust[K];

    handle = this.on(evt, wrapper, priority);
    return handle;
  }

  /** Called for every handler right after it is added - a subclass can label it (see `EventHandle#label`) */
  protected registered(_handle: { readonly event: string, label?: string }): void {}

  /** Runs one labelled handler - a subclass can time it */
  protected measure<T>(_label: string, run: () => T): T { return run(); }

  off<K extends keyof Cust>(evt: K, cb: Cust[K]): boolean {
    const arr = this._listeners[evt];
    if(!arr) return false;
    const before = arr.length;
    this._listeners[evt] = arr.filter(h => h.callback !== cb) as any;
    return this._listeners[evt]!.length < before;
  }

  onAny(cb: (evt: string, ...args: any[]) => void): EventHandle<any> {
    const handle = new EventHandle<any>("*", cb as any, this);
    this._anyListeners = [...this._anyListeners, handle]; // (a new array - see on())
    return handle;
  }

  // ── Calling ───────────────────────────────────────────────────────────────

  async call<K extends keyof Cust>(
    evt: K,
    event: Parameters<Cust[K]>[0] = undefined
  ): Promise<Parameters<Cust[K]>[0]> {
    const arr = this._listeners[evt];
    if(!arr) return event;

    for(const h of [...arr]) {       // a copy - on/off inside a handler are safe
      if(h.isPaused()) continue;
      const r = h.callback(event);
      if(r instanceof Promise) await r;
    }
    return event;
  }

  emit<K extends keyof Cust>(evt: K, ...args: Parameters<Cust[K]> | []): boolean {
    const arr = this._listeners[evt];
    const hasListeners = (arr && arr.length > 0) || this._anyListeners.length > 0;

    if(arr) {
      for(const h of arr) { // (never changed in place - see on())
        if(h.isPaused()) continue;
        const result = h.label === undefined ? h.callback(...args) : this.measure(h.label, () => h.callback(...args));
        if(result === false) return false;   // cancelable: returns false → stop
      }
    }

    // Notify wildcard listeners
    for(const h of this._anyListeners) {
      if(!h.isPaused()) h.callback(evt, ...args);
    }

    return !!hasListeners;
  }

  async emitR<K extends keyof Cust>(
    evt: K,
    ...args: Parameters<Cust[K]> | []
  ): Promise<ReturnType<Cust[K]>[]> {
    const arr = this._listeners[evt];
    if(!arr) return [];

    const results: ReturnType<Cust[K]>[] = [];
    for(const h of [...arr]) {
      if(h.isPaused()) continue;
      const r = h.callback(...args);
      results.push(r instanceof Promise ? await r : r);
    }
    return results;
  }

  /** как emitR, но синхронно: обработчики не ждём (для решения до возврата) */
  emitSync<K extends keyof Cust>(evt: K, ...args: Parameters<Cust[K]> | []): ReturnType<Cust[K]>[] {
    const arr = this._listeners[evt];
    if(!arr) return [];
    const results: ReturnType<Cust[K]>[] = [];
    for(const h of [...arr]) {
      if(h.isPaused()) continue;
      results.push(h.callback(...args));
    }
    return results;
  }

  wait<K extends keyof Cust>(
    evt: K,
    timeout = 10_000
  ): Promise<WaitResult<Cust, K>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        handle.remove();
        reject(new Error(`Events.wait timeout: "${String(evt)}" after ${timeout}ms`));
      }, timeout);

      const handle = this.once(evt, ((...args: any[]) => {
        clearTimeout(timer);
        resolve(args as any);
      }) as Cust[K], EventPriority.MONITOR);
    });
  }

  // ── Removal ───────────────────────────────────────────────────────────────

  removeByKey(key: string): boolean {
    let removed = false;
    for(const evt in this._listeners) {
      const arr = this._listeners[evt as keyof Cust];
      if(!arr) continue;
      const next = arr.filter(h => h.getKey() !== key);
      if(next.length < arr.length) { this._listeners[evt as keyof Cust] = next as any; removed = true; }
    }
    // wildcard is cleaned too
    const before = this._anyListeners.length;
    this._anyListeners = this._anyListeners.filter(h => h.getKey() !== key);
    return removed || this._anyListeners.length < before;
  }

  removeByGroup(group: string): number {
    let count = 0;
    for(const evt in this._listeners) {
      const arr = this._listeners[evt as keyof Cust];
      if(!arr) continue;
      const next = arr.filter(h => h.getGroup() !== group);
      count += arr.length - next.length;
      this._listeners[evt as keyof Cust] = next as any;
    }
    const before = this._anyListeners.length;
    this._anyListeners = this._anyListeners.filter(h => h.getGroup() !== group);
    count += before - this._anyListeners.length;
    return count;
  }

  removeAllListeners(evt?: keyof Cust): void {
    if(evt !== undefined) {
      delete this._listeners[evt];
    } else {
      this._listeners = {};
      this._anyListeners = [];
    }
  }

  // ── Introspection ─────────────────────────────────────────────────────────

  listenerCount(evt: keyof Cust): number {
    return this._listeners[evt]?.length ?? 0;
  }

  eventNames(): string[] {
    return Object.keys(this._listeners).filter(
      k => (this._listeners[k as keyof Cust]?.length ?? 0) > 0
    );
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private _removeHandle<K extends keyof Cust>(handle: EventHandle<Cust[K]>): void {
    if(handle.event == "*") {
      this._anyListeners = this._anyListeners.filter(h => h !== handle);
      return;
    }
    const arr = this._listeners[handle.event as keyof Cust];
    if(!arr) return;
    this._listeners[handle.event as keyof Cust] = arr.filter(h => h !== handle) as any;
  }
}
