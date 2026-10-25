/** роли мафии и мирных (номера как у сервера): мафия, террорист, бармен, информатор / остальные */
const mafiaRoles = [4, 6, 9, 11];
const peacefulRoles = [1, 2, 3, 5, 7, 8, 10];

export interface PlayerRecord {
  playedGames: number
  winsAsMafia: number
  winsAsPeaceful: number
  /** роль → сыграно игр */
  roleStatistics: Record<string, number>
}

export interface PlayerStats {
  gamesAsMafia: number
  gamesAsPeaceful: number
  totalWins: number
  /** доля побед от всех игр, %; `undefined`, пока игр нет */
  winRate?: number
  /** какую часть всех побед составляют победы за мафию / за мирных, % */
  mafiaShareOfWins?: number
  peacefulShareOfWins?: number
  /** победы за мафию от игр за мафию, % */
  mafiaWinRate?: number
  peacefulWinRate?: number
  /** победы за мирных к победам за мафию */
  peacefulToMafiaRatio?: number
}

const sum = (roles: readonly number[], statistics: Record<string, number>) => roles.reduce((total, role) => total + (statistics[role] ?? 0), 0);
const percent = (part: number, whole: number) => whole > 0 ? part * 100 / whole : undefined;

/** всё считается без деления на ноль: у нового игрока вместо NaN% поля пустые */
export function playerStats(record: PlayerRecord): PlayerStats {
  const gamesAsMafia = sum(mafiaRoles, record.roleStatistics);
  const gamesAsPeaceful = sum(peacefulRoles, record.roleStatistics);
  const totalWins = record.winsAsMafia + record.winsAsPeaceful;

  return {
    gamesAsMafia,
    gamesAsPeaceful,
    totalWins,
    winRate: percent(totalWins, record.playedGames),
    mafiaShareOfWins: percent(record.winsAsMafia, totalWins),
    peacefulShareOfWins: percent(record.winsAsPeaceful, totalWins),
    mafiaWinRate: percent(record.winsAsMafia, gamesAsMafia),
    peacefulWinRate: percent(record.winsAsPeaceful, gamesAsPeaceful),
    peacefulToMafiaRatio: record.winsAsMafia > 0 ? record.winsAsPeaceful / record.winsAsMafia : undefined
  };
}

/** сколько ещё побед подряд нужно, чтобы довести винрейт до целевого (0..1) */
export function winsNeededForRate(wins: number, games: number, targetRate: number): number {
  if(games == 0) return targetRate > 0 ? 1 : 0;
  const rate = wins / games;
  if(rate >= targetRate || targetRate >= 1) return rate >= targetRate ? 0 : Infinity;
  return Math.ceil((targetRate * games - wins) / (1 - targetRate));
}

/** ближайшие цели винрейта для подсказки «до N% нужно M побед» */
export function winRateTargets(currentPercent: number): number[] {
  if(currentPercent >= 90) return [95, 100];
  if(currentPercent >= 80) return [85, 90, 100];
  if(currentPercent >= 70) return [75, 80, 90, 100];
  if(currentPercent >= 60) return [70, 75, 80, 90];
  if(currentPercent >= 50) return [55, 60, 70];
  return [50, 60];
}
