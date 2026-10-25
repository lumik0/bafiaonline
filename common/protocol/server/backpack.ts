import { field, optionalField, serverPacket, t } from "../define";
import { K } from "../keys";

/** активированный предмет рюкзака (например VIP-аккаунт) */
const activeItem = t.object({
  id: field("aio", t.string),
  /** 0 - VIP-аккаунт */
  type: optionalField("itmt", t.numeric),
  /** параметры: "0" - скрыть значок (1), "1" - номер смайлика */
  params: optionalField("itmsps", t.record(t.numeric)),
  /** сколько секунд осталось */
  secondsLeft: optionalField("iea", t.numeric)
});

/** украшение в рюкзаке: `dt` тип, `dp` параметры (цвет #AARRGGBB), `bid` срок в секундах */
const decoration = t.object({
  id: field("bio", t.string),
  type: optionalField("dt", t.numeric),
  params: optionalField("dp", t.record(t.any)),
  seconds: optionalField("bid", t.numeric)
});

/** надетое украшение: `iea` - сколько секунд осталось */
const activeDecoration = t.object({
  id: field("aio", t.string),
  type: optionalField("dt", t.numeric),
  params: optionalField("dp", t.record(t.any)),
  secondsLeft: optionalField("iea", t.numeric)
});

export const backpackMessages = {
  backpack: serverPacket(K.BACKPACK_GET, {
    backpack: field(K.BACKPACK, t.object({
      active: optionalField("baits", t.array(activeItem)),
      /** предметы для применения: объекты {bio, itmt, bid, itmps} (или просто id) */
      items: optionalField("bits", t.array(t.any)),
      bds: optionalField("bds", t.array(decoration)),
      /** надетые украшения */
      bads: optionalField("bads", t.array(activeDecoration)),
      /** размер рюкзака */
      size: optionalField(K.BACKPACK_SIZE, t.numeric)
    }))
  }),

  backpackItemActivated: serverPacket("biad", {}),
  /** украшение надето; `bdrmd` и `badrmd` - id убранного и замененного */
  backpackDecorationActivated: serverPacket("bdad", {}),
  backpackDecorationRemoved: serverPacket("bdrmd", {}),
  backpackActiveDecorationRemoved: serverPacket("badrmd", {}),
  backpackItemUpdated: serverPacket("baiedd", {}),
  backpackItemRemoved: serverPacket("bairmd", {})
};
