/** ссылка-приглашение в комнату: адрес игры с параметром `?room=номер`; открывший её после входа сам заходит в комнату */
const ROOM_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** ссылка на комнату для друзей (без паролей и других параметров, например `server`) */
export function inviteUrl(roomId: string, page: { origin: string, pathname: string } = globalThis.location): string {
  return `${page.origin}${page.pathname}?room=${encodeURIComponent(roomId)}`;
}

/** номер комнаты из адреса страницы (`location.search`); мусор и чужие параметры - `undefined` */
export function inviteFromSearch(search: string): string | undefined {
  const id = new URLSearchParams(search).get("room");
  return id && ROOM_ID.test(id) ? id : undefined;
}
