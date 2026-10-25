import type { WorkerLike } from "@mods/index";

/**
 * воркер без потока для тестов: настоящий код воркера (`workerSource`) выполняется в этом же процессе,
 * а `self` и `globalThis` - обычный объект. Весь путь «мод ⇄ хост» при этом настоящий
 */
export function spawnInProcess(source: string): WorkerLike {
  const scope: any = {};
  const worker: WorkerLike = {
    onmessage: null, onerror: null,
    postMessage: message => queueMicrotask(() => scope.onmessage?.({ data: message })),
    terminate: () => { scope.onmessage = null; }
  };
  scope.postMessage = (message: unknown) => queueMicrotask(() => worker.onmessage?.({ data: message }));
  new Function("self", "globalThis", source)(scope, scope);
  return worker;
}
