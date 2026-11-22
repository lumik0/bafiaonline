/**
 * режим «Рулетка» (комната называется «рулетка» или «Позор мафии 2.0»): правила соблюдает клиент Бафии, сервер игры о них не знает.
 * Мафия ночью никого не убивает; днём в обычной «рулетке» голосовать можно за кого угодно.
 * В комнате «Позор мафии 2.0» каждый голосует только за следующего за ним живого игрока по кругу, а хост не участвует:
 * за него голосовать нельзя, и правила на него самого не действуют
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

/** цепочка голосов по кругу для чата: "[ник] => [ник2] => [ник]"; хост не считается, живых меньше двух - пусто */
export function rouletteChain(players: readonly { username: string, alive: boolean, playerObjectId: string }[], hostId?: string): string {
  const alive = players.filter(player => player.alive && player.playerObjectId != hostId);
  if(alive.length < 2) return "";
  return [...alive, alive[0]!].map(player => `[${player.username}]`).join(" => ");
}
