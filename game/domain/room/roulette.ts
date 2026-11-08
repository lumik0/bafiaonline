/**
 * режим «Рулетка» (комната называется «рулетка» или «Позор мафии 2.0»): правила соблюдает клиент Бафии, сервер игры о них не знает.
 * Днём каждый голосует только за следующего за ним живого игрока по кругу, мафия ночью никого не убивает.
 * В комнате «Позор мафии 2.0» хост ещё и не участвует: за него голосовать нельзя, и правила на него самого не действуют;
 * в обычной «рулетке» хост играет как все
 */
/** комната «Позор мафии 2.0»: рулетка, где хост в игре не участвует */
export const isHostFree = (title: string | undefined) => /позор мафии 2\.0/i.test(title ?? "");

export const isRoulette = (title: string | undefined) => /рулетка|позор мафии 2\.0/i.test(title ?? "");

/** за кого можно голосовать: следующий по кругу живой игрок после `me` (игроки в порядке стола), хост (`hostId`) пропускается; `undefined`, если больше никого нет */
export function rouletteTarget<T extends { playerObjectId: string, alive: boolean }>(players: readonly T[], myPlayerObjectId: string, hostId?: string): T | undefined {
  const start = players.findIndex(player => player.playerObjectId == myPlayerObjectId);
  if(start < 0) return undefined;
  for(let step = 1; step < players.length; step++) {
    const candidate = players[(start + step) % players.length]!;
    if(candidate.alive && candidate.playerObjectId != hostId) return candidate;
  }
  return undefined;
}
