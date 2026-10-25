import { field, optionalField, serverPacket, t } from "../define";

/** предложение: сколько стоит и на какой срок. Монеты: 0 - серебро, 1 - золото */
const offer = t.object({
  id: field("moid", t.numeric),
  coin: optionalField("moct", t.numeric),
  seconds: optionalField("mod", t.numeric),
  price: optionalField("mop", t.numeric)
});

/** параметры предмета или украшения: тип параметра → { номер варианта → подпись } */
const parameters = t.record(t.record(t.string));

const marketItem = t.object({
  item: field("mitm", t.object({
    id: field("itmid", t.numeric),
    /** 0 - VIP-аккаунт */
    type: optionalField("itmt", t.numeric),
    params: optionalField("itmps", parameters)
  })),
  offers: optionalField("mos", t.array(offer))
});

const marketDecoration = t.object({
  decoration: field("mdcr", t.object({
    id: field("did", t.numeric),
    type: optionalField("dt", t.numeric),
    params: optionalField("dp", parameters)
  })),
  offers: optionalField("mos", t.array(offer))
});

/** покупка за деньги: `url` - страница оплаты на сайте (для магазина, запрошенного с типом «сайт») */
const billingItem = t.object({
  productId: field("mpid", t.string),
  title: optionalField("tt", t.string),
  description: optionalField("dsc", t.string),
  coin: optionalField("mct", t.numeric),
  coins: optionalField("mca", t.numeric),
  url: optionalField("puk", t.string),
  priceText: optionalField("iprct", t.string)
});

const marketResponse = t.object({
  username: optionalField("u", t.string),
  billing: optionalField("mbi", t.array(billingItem)),
  items: optionalField("mitms", t.array(marketItem)),
  decorations: optionalField("mdcrs", t.array(marketDecoration)),
  /** пакеты серебра: покупаются за золото (`mop` - цена в золоте) */
  silverPacks: optionalField("misc", t.array(t.object({
    productId: field("mpid", t.string),
    coins: optionalField("mca", t.numeric),
    price: optionalField("mop", t.numeric)
  }))),
  account: optionalField("uac", t.object({
    gold: optionalField("gcns", t.numeric),
    silver: optionalField("scns", t.numeric)
  }))
});

export const marketMessages = {
  market: serverPacket("mrktg", { market: field("mr", marketResponse) }),
  marketFor: serverPacket("mrktgg", { market: field("mr", marketResponse) }),

  /** предмет куплен: `tt` - название, `uac` - монеты после покупки */
  marketItemBought: serverPacket("mbis", {
    title: optionalField("tt", t.string),
    itemType: optionalField("itmt", t.numeric),
    account: optionalField("uac", t.object({ gold: optionalField("gcns", t.numeric), silver: optionalField("scns", t.numeric) }))
  }),
  marketDecorationBought: serverPacket("mbds", {
    decorationType: optionalField("dt", t.numeric),
    account: optionalField("uac", t.object({ gold: optionalField("gcns", t.numeric), silver: optionalField("scns", t.numeric) }))
  }),
  /** рюкзак полон: предмет не поместился */
  backpackFull: serverPacket("bisfe", {
    amount: optionalField("biamnt", t.numeric),
    size: optionalField("bps", t.numeric),
    vipSize: optionalField("bpsv", t.numeric)
  })
};
