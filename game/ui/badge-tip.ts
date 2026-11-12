import Events from "@common/utils/emitter";
import { completeTip, markTipShown, tipActive } from "../domain/tips";
import type { GameContext } from "../context";

/** подсказка про галочку: показывает на экране галочку игрока и объясняет, что она значит; выполненная больше не появляется */
export class BadgeTip extends Events<{ change: () => void }> {
  active = false;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(private ctx: Pick<GameContext, "settings">) { super(); }

  get text() { return "Галочка у ника значит, что игрок тоже играет в Бафии: через этот клиент и сервер Бафии. Цвет галочки он выбирает сам, а горящая галочка бывает только у особых игроков, например разработчиков."; }

  /** режим экономии ресурсов: без кругов и искр */
  get calm() { return this.ctx.settings.data.lowPower; }

  /** показать подсказку, если на экране есть галочка; считается выполненной сразу, как показана */
  offer(has: () => boolean = () => !!document.querySelector("[data-badge]")) {
    if(this.active || !tipActive(this.ctx.settings, "badge") || !has()) return;
    markTipShown(this.ctx.settings, "badge");
    completeTip(this.ctx.settings, "badge");
    this.active = true;
    // не заметили - убираем сами
    this.timer = setTimeout(() => this.stop(), 25_000);
    this.emit("change");
  }

  stop() {
    clearTimeout(this.timer);
    if(!this.active) return;
    this.active = false;
    this.emit("change");
  }
}
