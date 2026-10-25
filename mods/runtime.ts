/**
 * код, который выполняется в Web Worker перед модом: даёт `mod`, закрывает сеть и диск
 * функция самодостаточна: её текст целиком уходит в воркер, внешних ссылок в ней быть не может
 * закрытие глобалов - вторая линия; главное - хост проверяет разрешение при каждом вызове
 */
export function workerMain(scope: any, granted: string[] = []) {
  const post = scope.postMessage.bind(scope);

  for(const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "indexedDB", "caches", "BroadcastChannel", "Worker", "SharedWorker", "WebTransport", "localStorage"]) {
    try {
      Object.defineProperty(scope, name, { value: undefined, configurable: false, writable: false });
    } catch {
      // уже закрыто или нет такого свойства
    }
  }

  let nextId = 1;
  const pending = new Map<number, { resolve(value: any): void, reject(error: Error): void }>();
  const listeners = new Map<string, Array<(data: any) => void>>();
  const commands = new Map<string, (args: string[]) => void>();
  const actions: Array<(id: string) => void> = [];
  const menus = new Map<string, { items(data: any): any, select?(id: string, data: any): void }>();
  let profileSection: { rows(data: any): any, action?(id: string, data: any): void } | undefined;

  const call = (method: string, ...args: unknown[]) => new Promise<any>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    post({ k: "call", id, method, args });
  });

  const mod = {
    permissions: {
      /** включено ли разрешение у игрока: он мог отключить его в списке модов */
      has: (permission: string) => granted.includes(permission),
      get granted() { return [...granted]; }
    },
    on(event: string, handler: (data: any) => void) {
      if(!listeners.has(event)) {
        listeners.set(event, []);
        post({ k: "on", event });
      }
      listeners.get(event)!.push(handler);
    },
    chat: { send: (text: string) => call("chat.send", text) },
    room: {
      say: (text: string) => call("room.say", text),
      players: () => call("room.players"),
      state: () => call("room.state"),
      act: (index: number) => call("room.act", index),
      vote: (index: number) => call("room.vote", index),
      giveUp: () => call("room.giveUp"),
      voteKick: (vote: boolean) => call("room.voteKick", vote),
      rehost: () => call("room.rehost")
    },
    screen: { current: () => call("screen.current") },
    account: { info: () => call("account.info") },
    notify: (text: string, options?: { title?: string, kind?: string }) => call("notify", text, options),
    storage: {
      get: (key: string) => call("storage.get", key),
      set: (key: string, value: unknown) => call("storage.set", key, value),
      remove: (key: string) => call("storage.remove", key)
    },
    theme: {
      set: (values: Record<string, string>) => call("theme.set", values),
      clear: () => call("theme.clear")
    },
    net: { fetch: (url: string) => call("net.fetch", url) },
    rooms: {
      enter: (id: string) => call("rooms.enter", id),
      waitAndJoin: (id: string) => call("rooms.waitAndJoin", id)
    },
    clipboard: { write: (text: string) => call("clipboard.write", text) },
    menu: {
      /** пункты контекстного меню: items(данные) и select(id, данные) */
      add(target: string, menu: { items(data: any): any, select?(id: string, data: any): void }) {
        menus.set(target, menu);
        post({ k: "menu", target });
      }
    },
    profile: {
      /** открыть профиль игрока в окне игры */
      open: (playerObjectId: string) => call("profile.open", playerObjectId),
      /** строки в профиле игрока: rows(профиль) возвращает [{ label, value, button?: { id, text } }] */
      section(section: { rows(data: any): any, action?(id: string, data: any): void }) {
        profileSection = section;
        post({ k: "profile" });
      }
    },
    commands: {
      register(name: string, handler: (args: string[]) => void) {
        commands.set(name, handler);
        post({ k: "command", name });
      }
    },
    ui: {
      /** панель из блоков: { type: "text", text } и { type: "button", id, text } */
      panel: (panel: { title: string, blocks: unknown[] }) => post({ k: "panel", panel }),
      dialog: (dialog: { title?: string, text: string }) => call("ui.dialog", dialog),
      onAction: (handler: (id: string) => void) => { actions.push(handler); }
    },
    log: (...parts: unknown[]) => post({ k: "log", text: parts.map(part => typeof part == "string" ? part : JSON.stringify(part)).join(" ") })
  };

  scope.mod = mod;
  scope.onmessage = (event: { data: any }) => {
    const message = event.data;
    if(message.k == "result") {
      const waiter = pending.get(message.id);
      pending.delete(message.id);
      if(waiter) message.ok ? waiter.resolve(message.value) : waiter.reject(new Error(message.error));
    } else if(message.k == "event") {
      for(const handler of listeners.get(message.event) ?? []) {
        try { handler(message.data); } catch(error) { mod.log("Ошибка в обработчике:", String(error)); }
      }
    } else if(message.k == "command") {
      try { commands.get(message.name)?.(message.args); } catch(error) { mod.log("Ошибка в команде:", String(error)); }
    } else if(message.k == "ask") {
      // хост спрашивает пункты меню или строки профиля: отвечаем, даже если обработчик упал (пустым ответом)
      const handler = message.what == "menu" ? menus.get(message.target)?.items : profileSection?.rows;
      Promise.resolve().then(() => handler?.(message.data)).then(
        value => post({ k: "answer", id: message.id, value }),
        error => { mod.log("Ошибка в обработчике меню:", String(error)); post({ k: "answer", id: message.id, value: undefined }); }
      );
    } else if(message.k == "select") {
      try { menus.get(message.target)?.select?.(message.itemId, message.data); } catch(error) { mod.log("Ошибка в обработчике меню:", String(error)); }
    } else if(message.k == "profileAction") {
      try { profileSection?.action?.(message.actionId, message.data); } catch(error) { mod.log("Ошибка в обработчике профиля:", String(error)); }
    } else if(message.k == "action") {
      for(const handler of actions) {
        try { handler(message.id); } catch(error) { mod.log("Ошибка в обработчике кнопки:", String(error)); }
      }
    }
  };
}

/** полный текст воркера: служебная часть, потом код мода в своей области видимости */
export const workerSource = (modCode: string, granted: readonly string[] = []) =>
  `(${workerMain.toString()})(self, ${JSON.stringify(granted)});\n;(function(){"use strict";\n${modCode}\n})();\n//# sourceURL=mod.js`;
