import { describe, expect, test } from "bun:test";

/** запускает play-sw.js в песочнице: поддельные self, caches и fetch; возвращает обработчики событий и журнал */
async function load(online = true) {
  const code = await Bun.file("public/play-sw.js").text();
  const listeners = new Map<string, (event: any) => void>();
  const store = new Map<string, Response>();
  const log = { fetched: [] as string[], deleted: [] as string[] };
  const self = { location: { origin: "https://site.test" }, skipWaiting() {}, clients: { claim: async() => {} }, addEventListener: (name: string, handler: (event: any) => void) => void listeners.set(name, handler) };
  const caches = {
    open: async() => ({ add: async(url: string) => void store.set(url, new Response("shell")), put: async(request: { url: string }, response: Response) => void store.set(request.url, response) }),
    keys: async() => ["bafia-play-v1", "bafia-play-v2"],
    delete: async(key: string) => { log.deleted.push(key); return true; },
    match: async(request: { url: string } | string) => store.get(typeof request == "string" ? request : request.url)?.clone()
  };
  const fetcher = async(request: { url: string }) => { log.fetched.push(request.url); if(!online) throw new Error("offline"); return new Response("fresh"); };
  new Function("self", "caches", "fetch", code)(self, caches, fetcher);
  const request = (url: string, mode: string, method = "GET") => ({ url, mode, method });
  const dispatch = async(req: ReturnType<typeof request>) => {
    let answered: Promise<Response> | undefined;
    listeners.get("fetch")!({ request: req, respondWith: (promise: Promise<Response>) => { answered = promise; } });
    return answered;
  };
  return { listeners, store, log, request, dispatch };
}

describe("play-sw.js", () => {
  test("обрабатывает только открытие страницы; файлы игры, чужие адреса и не-GET идут мимо воркера", async() => {
    const { request, dispatch, log } = await load();
    expect(await dispatch(request("https://site.test/play/bin/app.js", "no-cors"))).toBeUndefined();
    expect(await dispatch(request("https://site.test/play/anim.json", "cors"))).toBeUndefined();
    expect(await dispatch(request("https://other.test/play.html", "navigate"))).toBeUndefined();
    expect(await dispatch(request("https://site.test/play.html", "navigate", "POST"))).toBeUndefined();
    expect(log.fetched).toEqual([]);

    const page = await dispatch(request("https://site.test/play.html", "navigate"));
    expect(await page!.text()).toBe("fresh");
  });

  test("без сети страница открывается из кэша (запомненная копия или общая оболочка)", async() => {
    const online = await load(true);
    await (await online.dispatch(online.request("https://site.test/play.html", "navigate")))!.text();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(online.store.has("https://site.test/play.html")).toBe(true);

    const offline = await load(false);
    offline.store.set("./play.html", new Response("shell"));
    const page = await offline.dispatch(offline.request("https://site.test/play.html?x=1", "navigate"));
    expect(await page!.text()).toBe("shell");
  });

  test("старый кэш v1 удаляется при активации", async() => {
    const { listeners, log } = await load();
    let waited: Promise<unknown> | undefined;
    listeners.get("activate")!({ waitUntil: (promise: Promise<unknown>) => { waited = promise; } });
    await waited;
    expect(log.deleted).toEqual(["bafia-play-v1"]);
  });
});
