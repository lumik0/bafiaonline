import { GIPHY_PREFIX, giphyUrl, type GifItem } from "@common/bafia/protocol";

const cache = new Map<string, { at: number, items: GifItem[] }>();
const TTL = 10 * 60_000;

/** поиск в Giphy (пустой запрос - популярное); `undefined` - не вышло, остаётся свой каталог */
export async function searchGiphy(key: string, query: string, http: typeof fetch = fetch, now = Date.now): Promise<GifItem[] | undefined> {
  const normalized = query.trim().toLowerCase();
  const hit = cache.get(key + "|" + normalized);
  if(hit && now() - hit.at < TTL) return hit.items;

  const url = new URL(`https://api.giphy.com/v1/gifs/${normalized ? "search" : "trending"}`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("limit", "30");
  url.searchParams.set("rating", "pg-13");
  if(normalized) { url.searchParams.set("q", normalized); url.searchParams.set("lang", "ru"); }

  try {
    const response = await http(url, { referrerPolicy: "no-referrer" });
    if(!response.ok) return undefined;
    const body = await response.json() as { data?: { id?: unknown, title?: unknown }[] };
    const items = (body.data ?? []).flatMap((gif): GifItem[] =>
      typeof gif.id == "string" && /^[A-Za-z0-9]{5,30}$/.test(gif.id)
        ? [{ id: GIPHY_PREFIX + gif.id, url: giphyUrl(gif.id), thumb: giphyUrl(gif.id, "200w"), title: typeof gif.title == "string" ? gif.title.slice(0, 80) : "" }]
        : []
    );
    cache.set(key + "|" + normalized, { at: now(), items });
    if(cache.size > 200) cache.delete(cache.keys().next().value!);
    return items;
  } catch {
    return undefined;
  }
}

/** только для тестов */
export const clearGiphyCache = () => cache.clear();
