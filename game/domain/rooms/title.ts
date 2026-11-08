const key = (value: string) => value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/** подходит ли комната под название: без учёта регистра и лишних пробелов, часть названия тоже подходит; пустое ничему не подходит */
export const titleMatches = (room: { title: string }, wanted: string) => !!key(wanted) && key(room.title).includes(key(wanted));
