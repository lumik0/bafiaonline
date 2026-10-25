import type { ServerClient } from "@common/net";
import type { ServerData } from "@common/protocol";
import { argbToCss, DecorationParameter } from "./decorations";
import { VIP_ICONS } from "./vip-icons";

type WireItem = NonNullable<ServerData<"backpack">["backpack"]["active"]>[number];

/** применённый предмет. Пока умеем только VIP-аккаунт, остальные показываем как «неизвестный предмет» */
export interface ActiveItem {
  id: string
  kind: "vip" | "unknown"
  /** номер значка из `VIP_ICONS` */
  icon: number
  iconHidden: boolean
  secondsLeft: number
}

/** украшение в рюкзаке или надетое; `seconds` - срок или сколько осталось */
export interface Decoration {
  id: string
  type?: number
  /** CSS-цвет из параметра «цвет» (там #AARRGGBB), если он есть */
  color?: string
  seconds?: number
}

/** предмет в рюкзаке, который можно применить */
export interface PackItem {
  id: string
  /** 0 - VIP-аккаунт */
  type?: number
  seconds?: number
}

export interface BackpackContent {
  active: ActiveItem[]
  /** украшения в рюкзаке */
  decorations: Decoration[]
  /** надетые украшения */
  activeDecorations: Decoration[]
  /** предметы, ещё не применённые */
  items: PackItem[]
  /** сколько предметов всего и сколько ячеек */
  count: number
  size: number
}

type WireDecoration = { id: string, type?: number, params?: Record<string, unknown>, seconds?: number, secondsLeft?: number };

export function toDecoration(wire: WireDecoration): Decoration {
  return { id: wire.id, type: wire.type, color: argbToCss(wire.params?.[String(DecorationParameter.Color)]), seconds: wire.seconds ?? wire.secondsLeft };
}

/** предмет приходит объектом {bio, itmt, bid}; старые версии сервера присылали просто id */
export function toPackItem(raw: unknown): PackItem | undefined {
  if(typeof raw == "string") return { id: raw };
  const item = raw as { bio?: unknown, itmt?: unknown, bid?: unknown } | null;
  if(typeof item?.bio != "string") return undefined;
  return { id: item.bio, type: typeof item.itmt == "number" ? item.itmt : undefined, seconds: typeof item.bid == "number" ? item.bid : undefined };
}

export function toActiveItem(wire: WireItem): ActiveItem {
  return {
    id: wire.id,
    kind: wire.type === 0 ? "vip" : "unknown",
    icon: wire.params?.["1"] ?? 0,
    iconHidden: wire.params?.["0"] === 1,
    secondsLeft: Math.max(0, wire.secondsLeft ?? 0)
  };
}

/** значок VIP как он виден другим: 0 - по умолчанию (корона) */
export const vipIconSymbol = (index: number) => VIP_ICONS[index] || VIP_ICONS[1]!;

export const itemsWord = (count: number) => {
  const rest = count % 100, last = count % 10;
  if(rest > 10 && rest < 20) return "предметов";
  return last == 1 ? "предмет" : last >= 2 && last <= 4 ? "предмета" : "предметов";
};

/** рюкзак: список предметов, применение и настройка VIP-значка */
export class Backpack {
  constructor(private client: ServerClient) {}

  async load(): Promise<BackpackContent> {
    const { data } = await this.client.request("getBackpack", {}, "backpack");
    const { backpack } = data;
    const items = (backpack.items ?? []).map(toPackItem).filter((item): item is PackItem => !!item);
    return {
      active: (backpack.active ?? []).map(toActiveItem),
      decorations: (backpack.bds ?? []).map(toDecoration),
      activeDecorations: (backpack.bads ?? []).map(toDecoration),
      items,
      count: items.length + (backpack.bds?.length ?? 0),
      size: backpack.size ?? 0
    };
  }

  async activate(itemId: string) {
    await this.client.request("activateBackpackItem", { item: { itemId } }, "backpackItemActivated");
  }

  async setIcon(itemId: string, icon: number) {
    await this.client.request("updateBackpackItem", { item: { itemId, params: { "1": icon } } }, "backpackItemUpdated");
  }

  async setIconHidden(itemId: string, hidden: boolean) {
    await this.client.request("updateBackpackItem", { item: { itemId, params: { "0": hidden ? 1 : 0 } } }, "backpackItemUpdated");
  }

  /** надеть украшение: прежнее того же типа заменяется */
  async activateDecoration(itemId: string) {
    await this.client.request("activateBackpackDecoration", { item: { itemId } }, "backpackDecorationActivated");
  }

  async removeDecoration(itemId: string) {
    await this.client.request("removeBackpackDecoration", { item: { itemId } }, "backpackDecorationRemoved");
  }

  /** снять надетое украшение */
  async takeOffDecoration(itemId: string) {
    await this.client.request("removeActiveDecoration", { item: { itemId } }, "backpackActiveDecorationRemoved");
  }

  /** убрать закончившийся предмет */
  async remove(itemId: string) {
    await this.client.request("removeBackpackItem", { item: { itemId } }, "backpackItemRemoved");
  }
}
