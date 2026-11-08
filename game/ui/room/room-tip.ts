import Events from "@common/utils/emitter";
import { isMobile } from "@common/utils/mobile";
import { completeTip, markTipShown, tipActive } from "../../domain/tips";
import type { GameContext } from "../../context";

export type TipStep = "hold" | "menu" | "role" | "done";

/** подсказка «отметь роль»: какое сообщение и какого игрока показать и на каком шаге игрок; показывается по одной, выполненная больше не появляется */
export class RoomTip extends Events<{ change: () => void }> {
  player?: string
  entry?: number
  name = ""
  step: TipStep = "hold"
  private timer?: ReturnType<typeof setTimeout>

  constructor(private ctx: Pick<GameContext, "settings"> & { bafia?: Pick<GameContext["bafia"], "track"> }) { super(); }

  /** режим экономии ресурсов: без искр и конфетти */
  get calm() { return this.ctx.settings.data.lowPower; }

  get active() { return this.player !== undefined; }

  /** текст подсказки на текущем шаге */
  get text() {
    switch(this.step) {
      case "hold": return `${this.name} называет себя шерифом. ${isMobile() ? "Зажми его пальцем на столе" : "Нажми на него на столе правой кнопкой"}, чтобы отметить роль: так проще не запутаться.`;
      case "menu": return "Выбери «Отметить роль».";
      case "role": return "Теперь выбери «Шериф».";
      case "done": return "Готово! Роль отмечена, эта подсказка больше не появится.";
    }
  }

  /** игрок назвался шерифом в сообщении `entry`: показать сообщение и игрока */
  offer(playerObjectId: string, username: string, entry: number) {
    if(this.active || !tipActive(this.ctx.settings, "markRole")) return;
    markTipShown(this.ctx.settings, "markRole");
    this.player = playerObjectId;
    this.entry = entry;
    this.name = username;
    this.step = "hold";
    // если подсказку не заметили - убираем сами
    this.timer = setTimeout(() => this.stop(), 30_000);
    this.emit("change");
  }

  opened(playerObjectId: string) { this.go(playerObjectId, "menu"); }
  choosingRole(playerObjectId: string) { this.go(playerObjectId, "role"); }

  /** меню закрыли, ничего не отметив: подсказка ждёт дальше */
  cancelled(playerObjectId: string) {
    if(this.step != "hold") this.go(playerObjectId, "hold");
  }

  /** игрок отметил роль через меню (любому игроку): подсказка выполнена и больше не появится */
  marked() {
    const was = this.active;
    completeTip(this.ctx.settings, "markRole");
    if(!was) return;
    this.ctx.bafia?.track("feature:tipDone");
    clearTimeout(this.timer);
    this.step = "done";
    this.emit("change");
    this.timer = setTimeout(() => this.stop(), 2800);
  }

  stop() {
    clearTimeout(this.timer);
    if(!this.active) return;
    this.player = undefined;
    this.entry = undefined;
    this.step = "hold";
    this.emit("change");
  }

  private go(playerObjectId: string, step: TipStep) {
    if(this.player != playerObjectId) return;
    this.step = step;
    this.emit("change");
  }
}
