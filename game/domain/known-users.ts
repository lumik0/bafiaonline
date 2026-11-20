// id игрока (в каждой игре новый) -> постоянный id пользователя, как их присылают комнаты и чат
const known = new Map<string, string>();

export function rememberUser(playerObjectId: string | undefined, userObjectId: string | undefined) {
  if(!playerObjectId || !userObjectId) return;
  // старые записи вытесняются, чтобы карта не росла бесконечно
  if(known.size >= 5000 && !known.has(playerObjectId)) known.delete(known.keys().next().value!);
  known.set(playerObjectId, userObjectId);
}

export const knownUser = (playerObjectId: string | undefined) => (playerObjectId ? known.get(playerObjectId) : undefined);
