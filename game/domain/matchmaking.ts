import type { ServerClient } from "@common/net";
import type { ServerMessage } from "@common/protocol";
import Events from "@common/utils/emitter";
import { toRatingUsers, type RatingUser } from "./ratings";

type Handle = { remove(): void };

/** игроков в соревновательной партии */
export const MATCH_PLAYERS = 12;

/** роли, которые можно выбрать перед игрой, в порядке показа */
export const SELECTABLE_ROLES = [6, 9, 11, 2, 5, 7, 8, 10];

/** мало игроков выбрали роль - её шанс получить ниже */
export const SCARCE_ROLE_COUNT = 5;

export type MatchPhase = "loading" | "idle" | "searching" | "accepting" | "roles";

export interface MatchRoom {
  id: string
  roles: number[]
}

export interface MatchBan {
  reason: number
  seconds: number
}

export const banReasons: Record<number, string> = {
  0: "Ты не принял предыдущую игру",
  1: "Ты не присоединился к предыдущей игре",
  2: "Ты был неактивен в прошлой игре"
};

/** что соревновательный режим даёт и как устроен (текст «Подробнее») */
export const matchmakingInfo = "Игроки подбираются на основе количества кубков.\n\nИгроки голосуют за те роли, которые будут в комнате.\n\nИгроки победившей команды получают награды в виде различных предметов.";

export const energyInfo = "Энергия позволяет игрокам совершать разные действия и со временем восстанавливается.\n\nВ соревновательном режиме каждый раз, когда в комнате начинается игра, каждый игрок теряет энергию.\n\nУ VIP-игроков энергия бесконечна.";

export interface Energy {
  current: number
  maxFree?: number
  /** через сколько секунд прибавится единица */
  nextIn?: number
  /** через сколько секунд прибавится каждая следующая */
  interval?: number
}

export interface MatchState {
  phase: MatchPhase
  online: number
  /** найдено игроков для игры (при поиске) */
  found?: number
  /** приняли игру */
  accepted: number
  /** вы уже нажали «принять» */
  acceptedByMe: boolean
  secondsLeft: number
  /** вы ещё в начатой игре и можете в неё вернуться */
  canReturn: boolean
  /** роль → сколько игроков её выбрали */
  roleCounts: Record<number, number>
  /** роли, которые выбраны вами */
  selectedRoles: number[]
  /** «Сегодня на пьедестале» */
  podium: RatingUser[]
  energy?: Energy
}

/**
 * соревновательный режим: поиск игры, принятие, выбор ролей и переход в комнату
 * только последовательность пакетов - экран лишь рисует состояние и вызывает действия
 */
export class Matchmaking extends Events<{
  change: () => void
  room: (room: MatchRoom) => void
  banned: (ban: MatchBan) => void
  /** сообщение игроку: нет энергии, не хватает уровня, игра не собралась */
  notice: (text: string) => void
}> {
  state: MatchState = {
    phase: "loading", online: 0, accepted: 0, acceptedByMe: false, secondsLeft: 0, canReturn: false, roleCounts: {}, selectedRoles: [...SELECTABLE_ROLES], podium: []
  };
  private energyTimer?: ReturnType<typeof setInterval>;
  private handle?: Handle;
  private timer?: ReturnType<typeof setInterval>;

  constructor(private client: ServerClient) {
    super();
  }

  start() {
    this.handle = this.client.on("message", message => this.receive(message));
    this.client.send("getMatchmakingStatus", {});
    this.client.send("getMatchmakingOnline", { playersAmount: MATCH_PLAYERS });
  }

  stop() {
    this.handle?.remove();
    this.handle = undefined;
    this.stopTimer();
    if(this.energyTimer) clearInterval(this.energyTimer);
    this.energyTimer = undefined;
  }

  search() {
    if(this.state.phase != "idle") return;
    this.client.send("startMatchmakingSearch", { playersAmount: MATCH_PLAYERS });
    this.patch({ phase: "searching", found: undefined });
  }

  cancelSearch() {
    if(this.state.phase != "searching") return;
    this.client.send("stopMatchmakingSearch", {});
    this.client.send("getMatchmakingOnline", { playersAmount: MATCH_PLAYERS });
    this.patch({ phase: "idle" });
  }

  accept() {
    if(this.state.phase != "accepting" || this.state.acceptedByMe) return;
    this.client.send("acceptMatchmakingGame", {});
    this.patch({ acceptedByMe: true });
  }

  returnToGame() {
    if(this.state.canReturn) this.client.send("returnToMatchmakingRoom", {});
  }

  toggleRole(role: number, selected: boolean) {
    if(this.state.phase != "roles") return;
    if(selected) this.client.send("selectMatchmakingRole", { role });
    else this.client.send("unselectMatchmakingRole", { role });
    const roles = this.state.selectedRoles.filter(other => other != role);
    this.patch({ selectedRoles: selected ? [...roles, role] : roles });
  }

  private receive(message: ServerMessage) {
    switch(message.name) {
      case "matchmakingOnline": return this.patch({ online: message.data.online });
      case "matchmakingStatus": {
        const { inRoom, ratingUsers, energy } = message.data.status;
        if(energy) this.setEnergy({ current: energy.current, maxFree: energy.maxFree, nextIn: energy.firstTimer, interval: energy.nextTimers });
        return this.patch({
          canReturn: !!inRoom, podium: toRatingUsers(ratingUsers).slice(0, 3),
          phase: this.state.phase == "loading" ? "idle" : this.state.phase
        });
      }
      case "matchmakingAcceptedByMe": return this.patch({ acceptedByMe: true });
      case "matchmakingStopped": return this.patch({ phase: "idle", found: undefined });
      case "matchmakingNotAccepted":
        this.stopTimer();
        this.patch({ phase: "idle", found: undefined });
        return void this.emit("notice", "Игра не найдена: кто-то не принял её. Попробуй ещё раз");
      case "matchmakingNoEnergy":
        this.patch({ phase: "idle" });
        return void this.emit("notice", "Недостаточно энергии. Дождись, когда она восстановится, или купи VIP: у VIP-игроков энергия бесконечна");
      case "matchmakingLevelTooLow":
        this.patch({ phase: "idle" });
        return void this.emit("notice", `Чтобы играть в соревновательном режиме, нужен уровень не ниже ${String(message.data.level)}`);
      case "matchmakingFound": return this.state.phase == "searching" ? this.patch({ found: message.data.found }) : undefined;
      case "matchmakingAccept":
        this.countdown(message.data.secondsLeft ?? 0);
        return this.patch({ phase: "accepting", accepted: message.data.accepted ?? 0, acceptedByMe: false, canReturn: false });
      case "matchmakingAccepted": return this.patch({ accepted: message.data.accepted });
      case "matchmakingRoles":
        this.countdown(message.data.secondsLeft ?? 30);
        return this.patch({ phase: "roles", selectedRoles: [...SELECTABLE_ROLES] });
      case "matchmakingRoleCounts": {
        const roleCounts = { ...this.state.roleCounts };
        for(const [role, count] of Object.entries(message.data.counts)) roleCounts[Number(role)] = count;
        return this.patch({ roleCounts });
      }
      case "matchmakingRoom":
        // поиск закончен: сервер сам держит игрока в комнате
        this.client.send("stopMatchmakingSearch", {});
        this.stopTimer();
        return void this.emit("room", { id: message.data.room.id, roles: message.data.room.roles ?? [] });
      case "matchmakingBanned":
        this.stopTimer();
        this.patch({ phase: "idle" });
        return void this.emit("banned", { reason: message.data.reason, seconds: message.data.seconds });
    }
  }

  /** энергия: раз в `interval` секунд прибавляется единица, пока не дойдёт до бесплатного максимума */
  private setEnergy(energy: Energy) {
    this.patch({ energy });
    if(this.energyTimer) clearInterval(this.energyTimer);
    this.energyTimer = setInterval(() => {
      const current = this.state.energy;
      if(!current?.nextIn) return;
      if(current.nextIn > 1) return this.patch({ energy: { ...current, nextIn: current.nextIn - 1 } });
      const next = current.current + 1;
      const full = current.maxFree !== undefined && next >= current.maxFree;
      this.patch({ energy: { ...current, current: next, nextIn: full ? undefined : current.interval } });
    }, 1000);
  }

  private countdown(seconds: number) {
    this.stopTimer();
    this.patch({ secondsLeft: seconds });
    this.timer = setInterval(() => {
      if(this.state.secondsLeft > 0) this.patch({ secondsLeft: this.state.secondsLeft - 1 });
    }, 1000);
  }

  private stopTimer() {
    if(this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private patch(changes: Partial<MatchState>) {
    this.state = { ...this.state, ...changes };
    this.emit("change");
  }
}
