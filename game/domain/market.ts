import type { ServerClient } from "@common/net";
import { RequestTimeoutError } from "@common/net";
import { BillingType, type ServerData } from "@common/protocol";

type Response = ServerData<"market">["market"];

export type Coin = "silver" | "gold";

export interface Offer {
  id: number
  coin: Coin
  seconds?: number
  price: number
}

/** предмет магазина (VIP-аккаунт): варианты параметра - например, значок */
export interface ShopItem {
  id: number
  vip: boolean
  offers: Offer[]
  /** тип параметра → варианты (номер, подпись) */
  options: { type: string, variants: { id: number, label: string }[] }[]
}

/** украшение магазина: варианты параметров - готовые значения (цвет, имя файла анимации и т.д.) */
export interface ShopDecoration {
  id: number
  type: number
  offers: Offer[]
  options: { type: string, variants: { id: number, label: string }[] }[]
}

/** пакет серебра: покупается за золото */
export interface SilverPack {
  productId: string
  coins: number
  /** цена в золоте */
  price: number
}

/** покупка за деньги: оплата на сайте по ссылке от сервера */
export interface MoneyOffer {
  productId: string
  title: string
  description: string
  priceText: string
  coins?: number
  /** только https: другие ссылки не открываем */
  url?: string
}

export interface MarketView {
  /** для чьего аккаунта магазин (ник); у своего - свой */
  username?: string
  gold: number
  silver: number
  items: ShopItem[]
  money: MoneyOffer[]
  decorations: ShopDecoration[]
  silverPacks: SilverPack[]
}

export type BuyResult =
  | { status: "ok", title?: string, gold?: number, silver?: number }
  | { status: "full", size?: number };

/** ISO3-код языка заглавными, как у официального приложения: "RUS" */
export const languageCode = (language = (typeof navigator != "undefined" && navigator.language) || "ru") =>
  ({ ru: "RUS", en: "ENG", uk: "UKR", be: "BEL", kk: "KAZ" } as Record<string, string>)[language.slice(0, 2).toLowerCase()] ?? "ENG";

/** ссылку на оплату открываем, только если это https без логина и пароля */
export function safePaymentUrl(value: string | undefined): string | undefined {
  if(!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol == "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

const COINS: Record<number, Coin> = { 0: "silver", 1: "gold" };
export const coinName: Record<Coin, string> = { silver: "серебра", gold: "золота" };

const toOffers = (offers: { id: number, coin?: number, seconds?: number, price?: number }[] | undefined): Offer[] =>
  (offers ?? []).map(offer => ({ id: offer.id, coin: COINS[offer.coin ?? 1] ?? "gold", seconds: offer.seconds, price: offer.price ?? 0 }));

const toOptions = (params: Record<string, Record<string, string>> | undefined) =>
  Object.entries(params ?? {}).map(([type, variants]) => ({ type, variants: Object.entries(variants).map(([id, label]) => ({ id: Number(id), label })) }));

export function toMarketView(response: Response): MarketView {
  const items = (response.items ?? []).map((entry): ShopItem => ({
    id: entry.item.id,
    vip: entry.item.type === 0,
    offers: toOffers(entry.offers),
    options: toOptions(entry.item.params)
  }));

  return {
    username: response.username,
    gold: response.account?.gold ?? 0,
    silver: response.account?.silver ?? 0,
    items,
    money: (response.billing ?? []).map(item => ({
      productId: item.productId, title: item.title ?? "", description: item.description ?? "",
      priceText: item.priceText ?? "", coins: item.coins, url: safePaymentUrl(item.url)
    })),
    decorations: (response.decorations ?? []).map((entry): ShopDecoration => ({
      id: entry.decoration.id, type: entry.decoration.type ?? -1, offers: toOffers(entry.offers), options: toOptions(entry.decoration.params)
    })),
    silverPacks: (response.silverPacks ?? []).map((pack): SilverPack => ({ productId: pack.productId, coins: pack.coins ?? 0, price: pack.price ?? 0 }))
  };
}

/** магазин: предложения за монеты и за деньги (оплата на сайте, можно для другого игрока по нику) */
export class Market {
  constructor(private client: ServerClient, private language = languageCode()) {}

  /** `forUsername` - магазин для другого игрока: ссылки на оплату будут для его аккаунта */
  async load(forUsername?: string): Promise<MarketView> {
    const billingType = BillingType.Site;
    const answer = forUsername
      ? await this.client.request("getMarketFor", { billingType, user: forUsername, language: this.language }, "marketFor")
      : await this.client.request("getMarket", { billingType, language: this.language }, "market");
    return toMarketView(answer.data.market);
  }

  /** купить предмет за монеты. Параметры - выбранный вариант каждого (по умолчанию первый) */
  async buy(item: ShopItem, offer: Offer, chosen: Record<string, number> = {}): Promise<BuyResult> {
    const params: Record<string, number> = {};
    for(const option of item.options) params[option.type] = chosen[option.type] ?? option.variants[0]?.id ?? 0;

    const answer = await this.client.request("buyMarketItem", { purchase: { itemId: item.id, offerId: offer.id, params } }, ["marketItemBought", "backpackFull"]);
    if(answer.name == "backpackFull") return { status: "full", size: answer.data.size };
    return { status: "ok", title: answer.data.title, gold: answer.data.account?.gold, silver: answer.data.account?.silver };
  }

  /** купить украшение за монеты; выбранный вариант каждого параметра (по умолчанию первый) */
  async buyDecoration(decoration: ShopDecoration, offer: Offer, chosen: Record<string, number> = {}): Promise<BuyResult> {
    const params: Record<string, number> = {};
    for(const option of decoration.options) params[option.type] = chosen[option.type] ?? option.variants[0]?.id ?? 0;

    const answer = await this.client.request("buyMarketDecoration", { purchase: { decorationId: decoration.id, offerId: offer.id, params } }, ["marketDecorationBought", "backpackFull"]);
    if(answer.name == "backpackFull") return { status: "full", size: answer.data.size };
    return { status: "ok", gold: answer.data.account?.gold, silver: answer.data.account?.silver };
  }

  /**
   * пакет серебра за золото; ответа сервера на пакет нет,
   * итог определяется по монетам после перезагрузки магазина (это делает экран)
   */
  async buySilverPack(pack: SilverPack): Promise<{ status: "ok", gold?: number, silver?: number } | { status: "unknown" }> {
    try {
      const answer = await this.client.request("buySilverPack", { productId: pack.productId }, "marketItemBought", { timeout: 6000 });
      return { status: "ok", gold: answer.data.account?.gold, silver: answer.data.account?.silver };
    } catch(error) {
      if(error instanceof RequestTimeoutError) return { status: "unknown" };
      throw error;
    }
  }
}
