import { describe, expect, test } from "bun:test";
import { GifCache } from "./gif-cache";

function setup(options: { maxBytes?: number } = {}) {
  let now = 1_000_000, counter = 0;
  const requests: string[] = [], revoked: string[] = [];
  let failing = false;
  const sizes: Record<string, number> = {};
  const http = async(url: string) => {
    requests.push(url);
    if(failing) return new Response("no", { status: 500 });
    return new Response(new Uint8Array(sizes[url] ?? 10));
  };
  const cache = new GifCache({ fetch: http, createUrl: () => "blob:" + ++counter, revokeUrl: url => void revoked.push(url), now: () => now, ttl: 5 * 60_000, ...options });
  return { cache, requests, revoked, sizes, advance: (ms: number) => { now += ms; }, fail: (value: boolean) => { failing = value; } };
}

describe("GifCache", () => {
  test("гифка скачивается один раз, повторные запросы получают тот же blob-адрес", async() => {
    const { cache, requests } = setup();
    const [first, second] = await Promise.all([cache.load("https://x/a.gif"), cache.load("https://x/a.gif")]);
    expect(first).toBe("blob:1");
    expect(second).toBe("blob:1");
    expect(await cache.load("https://x/a.gif")).toBe("blob:1");
    expect(requests).toEqual(["https://x/a.gif"]);
  });

  test("через 5 минут запись удаляется, blob-адрес освобождается, а новая загрузка скачивает заново", async() => {
    const { cache, requests, revoked, advance } = setup();
    expect(await cache.load("https://x/a.gif")).toBe("blob:1");
    advance(4 * 60_000);
    expect(await cache.load("https://x/a.gif")).toBe("blob:1");
    advance(60_000);
    expect(await cache.load("https://x/a.gif")).toBe("blob:2");
    expect(revoked).toEqual(["blob:1"]);
    expect(requests).toHaveLength(2);
  });

  test("ошибка скачивания: отдаётся сам адрес, неудача не запоминается", async() => {
    const { cache, requests, fail } = setup();
    fail(true);
    expect(await cache.load("https://x/b.gif")).toBe("https://x/b.gif");
    expect(cache.size).toBe(0);
    fail(false);
    expect(await cache.load("https://x/b.gif")).toBe("blob:1");
    expect(requests).toHaveLength(2);
  });

  test("объём ограничен: самые старые вытесняются, их адреса освобождаются", async() => {
    const { cache, revoked, sizes } = setup({ maxBytes: 100 });
    Object.assign(sizes, { "https://x/1.gif": 60, "https://x/2.gif": 60, "https://x/3.gif": 30 });
    await cache.load("https://x/1.gif");
    await cache.load("https://x/2.gif");
    expect(revoked).toEqual(["blob:1"]);
    await cache.load("https://x/3.gif");
    expect(cache.size).toBe(2);
    cache.clear();
    expect(revoked.sort()).toEqual(["blob:1", "blob:2", "blob:3"]);
    expect(cache.size).toBe(0);
  });
});
