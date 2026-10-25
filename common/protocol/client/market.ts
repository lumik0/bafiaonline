import { clientPacket, field, t } from "../define";

/** способ оплаты за деньги (в запросе магазина): 0 - Google Play, 1 - оплата на сайте */
export const BillingType = { Google: 0, Site: 1 } as const;

export const marketPackets = {
  /** магазин для себя. language - ISO3 заглавными ("RUS") */
  getMarket: clientPacket("mrktg", {
    billingType: field("mbt", t.number),
    language: field("alc", t.string)
  }, { auth: true }),

  /** магазин для другого игрока (покупка за деньги «через ник»): ссылки на оплату привязаны к его аккаунту */
  getMarketFor: clientPacket("mrktgg", {
    billingType: field("mbt", t.number),
    user: field("ur", t.string),
    language: field("alc", t.string)
  }, { auth: true }),

  /** купить предмет за внутриигровые монеты. params: тип параметра → выбранный вариант */
  buyMarketItem: clientPacket("mbuyi", {
    purchase: field("mbuyir", t.object({
      itemId: field("itmid", t.number),
      offerId: field("moid", t.number),
      params: field("itmps", t.record(t.number))
    }))
  }),

  /** купить украшение за монеты. params: тип параметра → номер выбранного варианта */
  buyMarketDecoration: clientPacket("bd", {
    purchase: field("bdr", t.object({
      decorationId: field("did", t.number),
      offerId: field("moid", t.number),
      params: field("dp", t.record(t.number))
    }))
  }),

  /** купить пакет серебра за золото (`mpid` из списка пакетов магазина) */
  buySilverPack: clientPacket("bsci", {
    productId: field("mpid", t.string)
  }, { auth: true })
};
