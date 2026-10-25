// официальный мод Бафии: есть у каждого игрока, все разрешения включены, его можно выключить, но не удалить
// работает через то же API, что и любой другой мод
import { mod } from "bafia:api";
import { playerStats, winRateTargets, winsNeededForRate } from "./stats";

// --- меню комнаты в списке комнат ---

mod.menu.add("room", {
  items: room => [
    { id: "join", label: "Зайти" },
    { id: "wait", label: `Зайти, когда будет ${room.maxPlayers - 1} игроков` },
    { id: "copy", label: "Скопировать id комнаты" }
  ],
  select(id, room) {
    if(id == "join") void mod.rooms.enter(room.id);
    else if(id == "wait") void mod.rooms.waitAndJoin(room.id);
    else if(id == "copy") void mod.clipboard.write(room.id);
  }
});

// --- настройки комнаты (шестерёнка в шапке) и кнопки в окне «Игра окончена» ---

mod.menu.add("roomSettings", {
  items: () => [{ id: "rehost", label: "Рехост" }],
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
      { label: "player object id", value: profile.playerObjectId }
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

// --- авто-клик: игрок из меню стола, на которого ход делается сам, как только он станет доступен ---

const auto = new Set<string>();
const done = new Set<string>();
let lastStep: string | undefined;

/** один автоматический ход на этап: после хода (или если игрок не выбран) ждём следующего этапа */
async function autoClick(room: RoomSnapshot | null) {
  if(!room || room.phase != "game" || !room.me?.alive) return;
  if(room.step != lastStep) {
    lastStep = room.step;
    done.clear();
  }
  const target = room.players.find(player => auto.has(player.playerObjectId) && player.action && !done.has(player.playerObjectId));
  if(!target) return;
  done.add(target.playerObjectId);
  await mod.room.act(target.index).catch(() => {});
}

mod.menu.add("player", {
  items: player => player.alive ? [{ id: "auto", label: `${auto.has(player.playerObjectId) ? "✅ " : ""}Авто-клик` }] : [],
  async select(id, player) {
    if(id != "auto") return;
    if(auto.has(player.playerObjectId)) auto.delete(player.playerObjectId);
    else auto.add(player.playerObjectId);
    done.delete(player.playerObjectId);
    await autoClick(await mod.room.state());
  }
});

mod.on("room:state", room => void autoClick(room));
// вышли из комнаты - выбор забывается
mod.on("screen:change", ({ name }) => {
  if(name == "room") return;
  auto.clear();
  done.clear();
  lastStep = undefined;
});

type RoomSnapshot = import("bafia:api").RoomSnapshot;
