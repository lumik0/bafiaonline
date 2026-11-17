// официальный мод Бафии: есть у каждого игрока, все разрешения включены, его можно выключить, но не удалить
// работает через то же API, что и любой другой мод
import { mod } from "bafia:api";
import { playerStats, winRateTargets, winsNeededForRate } from "./stats";

// --- меню комнаты в списке комнат ---

mod.menu.add("room", {
  items: room => [
    { id: "join", label: "Зайти" },
    { id: "wait", label: `Зайти, когда будет ${room.maxPlayers - 1} игроков` },
    { id: "copy", label: "Скопировать id комнаты" },
    { id: "invite", label: "Скопировать ссылку-приглашение" },
    { id: "rehost", label: "Рехост" }
  ],
  select(id, room) {
    if(id == "join") void mod.rooms.enter(room.id);
    else if(id == "wait") void mod.rooms.waitAndJoin(room.id);
    else if(id == "copy") void mod.clipboard.write(room.id);
    else if(id == "invite") void mod.clipboard.write(room.inviteUrl);
    else if(id == "rehost") void mod.rooms.rehost(room.id);
  }
});

// --- настройки комнаты (шестерёнка в шапке) и кнопки в окне «Игра окончена» ---

mod.menu.add("roomSettings", {
  // пока идёт игра и ты в ней, рехост недоступен
  items: room => [{ id: "rehost", label: "Рехост", disabled: !!room.playing }],
  select(id) {
    if(id == "rehost") void mod.room.rehost();
  }
});

mod.menu.add("gameOver", {
  items: game => [
    ...(game.host ? [{ id: "host", label: "Профиль хоста" }] : []),
    { id: "rehost", label: "Захостить" }
  ],
  select(id, game) {
    if(id == "host" && game.host) void mod.profile.open(game.host.playerObjectId);
    else if(id == "rehost") void mod.room.rehost();
  }
});

// --- расширенная статистика в профиле ---

const percent = (value: number | undefined, digits = 1) => value === undefined ? "-" : value.toFixed(digits) + "%";

mod.profile.section({
  rows(profile) {
    const stats = playerStats(profile);
    return [
      { label: "Сыграно игр за Мафию", value: stats.gamesAsMafia },
      { label: "Сыграно игр за Мирных", value: stats.gamesAsPeaceful },
      { label: "Всего побед", value: `(${percent(stats.winRate, 2)}) ${stats.totalWins}`, button: { id: "winrate", text: "?" } },
      { label: "M/M", value: stats.peacefulToMafiaRatio === undefined ? "-" : stats.peacefulToMafiaRatio.toFixed(2) },
      { label: "player object id", value: profile.playerObjectId },
      { label: "user object id", value: profile.userObjectId || "-" }
    ];
  },
  action(id, profile) {
    if(id != "winrate") return;
    const stats = playerStats(profile);
    const rate = profile.playedGames > 0 ? stats.totalWins / profile.playedGames : 0;
    const lines = winRateTargets(rate * 100)
      .filter(target => target / 100 > rate)
      .map(target => {
        const needed = winsNeededForRate(stats.totalWins, profile.playedGames, target / 100);
        return needed == Infinity ? `До ${target}% не дойти одними победами` : `До ${target}% нужно побед подряд: ${needed}`;
      });
    void mod.ui.dialog({ title: "ВИНРЕЙТ", text: lines.length ? lines.join("\n") : "Ты на максимуме" });
  }
});

// --- авто-клик: игрок из меню стола, на которого ход делается сам один раз, как только он станет доступен ---

/** выбран ровно один игрок: новый выбор заменяет прежний (иначе старый выбор мог сработать раньше нового и проверить не того) */
let auto: string | undefined;

/** один автоматический ход: выбор снимается сразу, до отправки, чтобы быстрые обновления комнаты не отправили второй ход */
async function autoClick(room: RoomSnapshot | null) {
  if(!auto || !room || room.phase != "game" || !room.me?.alive) return;
  const target = room.players.find(player => player.playerObjectId == auto && player.action);
  if(!target) return;
  auto = undefined;
  await mod.room.act(target.index).catch(() => {});
}

mod.menu.add("player", {
  // в рулетке авто-клик есть только у «своего» игрока: меню остальных пункта не показывает
  items: player => player.alive && player.autoAllowed !== false ? [{ id: "auto", label: `${auto == player.playerObjectId ? "✅ " : ""}Авто-клик` }] : [],
  async select(id, player) {
    if(id != "auto") return;
    auto = auto == player.playerObjectId ? undefined : player.playerObjectId;
    await autoClick(await mod.room.state());
  }
});

mod.on("room:state", room => void autoClick(room));
// вышли из комнаты - выбор забывается
mod.on("screen:change", ({ name }) => {
  if(name == "room") return;
  auto = undefined;
});

type RoomSnapshot = import("bafia:api").RoomSnapshot;
