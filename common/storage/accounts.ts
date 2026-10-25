import { JsonDocument } from "./document";
import type { FileStore } from "./files";

export const ACCOUNTS_PATH = "/profiles.json";

/** формат как в старой версии: массив без обёртки */
export interface Account {
  version: number
  /** пустое имя - аккаунт ещё не выбрал никнейм */
  name: string
  email?: string
  password?: string
  token?: string
  userId?: string
  playerUserId?: string
  photo?: string
  needUpdate?: boolean
  /** поля, о которых эта версия не знает, сохраняются как есть */
  [extra: string]: unknown
}

export const ACCOUNT_VERSION = 1;

const text = (value: unknown) => typeof value == "string" ? value : undefined;

function normalizeAccount(raw: unknown): Account | undefined {
  if(typeof raw != "object" || raw === null || Array.isArray(raw)) return undefined;
  const entry = raw as Record<string, unknown>;

  return {
    ...entry,
    version: typeof entry.version == "number" ? entry.version : 1,
    name: text(entry.name) ?? "",
    email: text(entry.email),
    password: text(entry.password),
    token: text(entry.token),
    userId: text(entry.userId),
    playerUserId: text(entry.playerUserId),
    photo: text(entry.photo),
    needUpdate: typeof entry.needUpdate == "boolean" ? entry.needUpdate : undefined
  };
}

const sameValue = (a?: string, b?: string) => !!a && a == b;

/** один и тот же аккаунт: совпал id, токен или ник. Пустые значения не считаются совпадением */
export const isSameAccount = (a: Account, b: Partial<Account>) =>
  sameValue(a.userId, b.userId) || sameValue(a.playerUserId, b.playerUserId) || sameValue(a.token, b.token) || sameValue(a.name, b.name);

export interface AccountsExport {
  format: "bafiaonline-accounts"
  version: 1
  accounts: Account[]
}

export class Accounts {
  private document: JsonDocument<Account[]>;

  constructor(files: FileStore) {
    this.document = new JsonDocument<Account[]>(files, {
      path: ACCOUNTS_PATH,
      defaults: () => [],
      migrate: raw => (Array.isArray(raw) ? raw : []).flatMap(entry => normalizeAccount(entry) ?? [])
    });
  }

  list() {
    return this.document.read();
  }

  /** меняет найденный аккаунт или добавляет новый. Переданные поля заменяют старые, пропущенные остаются */
  upsert(patch: Partial<Account>): Promise<{ account: Account, created: boolean }> {
    return this.document.update(accounts => {
      const existing = accounts.find(account => isSameAccount(account, patch));
      const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));

      if(existing) {
        Object.assign(existing, defined, { version: ACCOUNT_VERSION });
        return { account: existing, created: false };
      }

      const account: Account = { name: "", ...defined, version: ACCOUNT_VERSION };
      accounts.push(account);
      return { account, created: true };
    });
  }

  /** например, задать ник новому аккаунту (`find` - как найти запись) */
  modify(find: (account: Account) => boolean, change: (account: Account) => void): Promise<boolean> {
    return this.document.update(accounts => {
      const account = accounts.find(find);
      if(account) change(account);
      return !!account;
    });
  }

  remove(find: (account: Account) => boolean): Promise<boolean> {
    return this.document.update(accounts => {
      const index = accounts.findIndex(find);
      if(index != -1) accounts.splice(index, 1);
      return index != -1;
    });
  }

  /** добавляет записи (существующие обновляет); возвращает число принятых */
  async importRaw(entries: unknown[]): Promise<number> {
    const incoming = entries.flatMap(entry => normalizeAccount(entry) ?? []);
    for(const account of incoming) await this.upsert(account);
    return incoming.length;
  }

  /** ВНИМАНИЕ: в экспорте лежат пароли и токены, хранить как пароль */
  async exportJson(): Promise<string> {
    const data: AccountsExport = { format: "bafiaonline-accounts", version: 1, accounts: await this.list() };
    return JSON.stringify(data, null, 2);
  }

  /** добавляет к существующим, существующие обновляет. Возвращает число обработанных записей */
  async importJson(json: string): Promise<number> {
    const data = JSON.parse(json) as Partial<AccountsExport>;
    if(data?.format != "bafiaonline-accounts" || !Array.isArray(data.accounts)) throw new Error("Это не файл экспорта аккаунтов Бафии");

    return this.importRaw(data.accounts);
  }
}
