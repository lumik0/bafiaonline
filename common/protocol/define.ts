export class ProtocolError extends Error {
  constructor(path: string, expected: string, received: unknown) {
    super(`${path}: ожидалось ${expected}, получено ${received === null ? "null" : typeof received}`);
    this.name = "ProtocolError";
  }
}

export interface Codec<T> {
  encode(value: T): unknown
  decode(wire: unknown, path: string): T
}

/** поле можно не передавать / сервер может его не прислать */
export interface OptionalCodec<T> extends Codec<T | undefined> {
  readonly optional: true
}

export interface Field<C extends Codec<any> = Codec<any>> {
  readonly key: string
  readonly codec: C
}

export type Shape = Record<string, Field>;

type ValueOf<F> = F extends Field<Codec<infer T>> ? T : never;
type OptionalKeys<S extends Shape> = { [K in keyof S]: S[K]["codec"] extends OptionalCodec<any> ? K : never }[keyof S];
type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** TS-тип данных, описанных схемой: имена полей читаемые, ключи пакета спрятаны */
export type Infer<S extends Shape> = Simplify<
  { [K in Exclude<keyof S, OptionalKeys<S>>]: ValueOf<S[K]> } &
  { [K in OptionalKeys<S>]?: Exclude<ValueOf<S[K]>, undefined> }
>;

const primitive = <T>(kind: "string" | "number" | "boolean"): Codec<T> => ({
  encode: value => value,
  decode(wire, path) {
    if(typeof wire != kind) throw new ProtocolError(path, kind, wire);
    return wire as T;
  }
});

export const t = {
  string: primitive<string>("string"),
  number: primitive<number>("number"),
  boolean: primitive<boolean>("boolean"),

  /** сервер местами присылает числа строкой ("12"): принимаем оба вида */
  numeric: {
    encode: value => value,
    decode(wire, path) {
      if(typeof wire == "number") return wire;
      if(typeof wire == "string" && wire.trim() != "" && !Number.isNaN(Number(wire))) return Number(wire);
      throw new ProtocolError(path, "number", wire);
    }
  } as Codec<number>,

  /** признак «да/нет»: сервер присылает то числом 0/1, то true/false; на выходе число */
  flag: {
    encode: value => value,
    decode(wire, path) {
      if(typeof wire == "boolean") return wire ? 1 : 0;
      if(typeof wire == "number") return wire;
      throw new ProtocolError(path, "number или boolean", wire);
    }
  } as Codec<number>,

  /** содержимое не описано схемой, отдаётся как есть */
  any: { encode: (value: unknown) => value, decode: (wire: unknown) => wire } as Codec<unknown>,

  optional<T>(codec: Codec<T>): OptionalCodec<T> {
    return {
      optional: true,
      encode: value => value === undefined ? undefined : codec.encode(value),
      decode: (wire, path) => wire === undefined || wire === null ? undefined : codec.decode(wire, path)
    };
  },

  array<T>(item: Codec<T>): Codec<T[]> {
    return {
      encode: value => value.map(item.encode),
      decode(wire, path) {
        if(!Array.isArray(wire)) throw new ProtocolError(path, "array", wire);
        return wire.map((element, i) => item.decode(element, `${path}[${i}]`));
      }
    };
  },

  /** объект с произвольными строковыми ключами, одинаковые значения */
  record<T>(value: Codec<T>): Codec<Record<string, T>> {
    return {
      encode: record => Object.fromEntries(Object.entries(record).map(([k, v]) => [k, value.encode(v)])),
      decode(wire, path) {
        if(!isObject(wire)) throw new ProtocolError(path, "object", wire);
        return Object.fromEntries(Object.entries(wire).map(([k, v]) => [k, value.decode(v, `${path}.${k}`)]));
      }
    };
  },

  object<S extends Shape>(shape: S): Codec<Infer<S>> {
    return {
      encode: value => encodeShape(shape, value as Record<string, unknown>),
      decode(wire, path) {
        if(!isObject(wire)) throw new ProtocolError(path, "object", wire);
        return decodeShape(shape, wire, path) as Infer<S>;
      }
    };
  }
};

/** `field("tx", t.string)` - поле с читаемым именем (задаётся ключом в схеме) и реальным ключом пакета */
export const field = <C extends Codec<any>>(key: string, codec: C): Field<C> => ({ key, codec });

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value == "object" && value !== null && !Array.isArray(value);

export function encodeShape(shape: Shape, value: Record<string, unknown>): Record<string, unknown> {
  const wire: Record<string, unknown> = {};
  for(const [name, { key, codec }] of Object.entries(shape)) {
    const encoded = codec.encode(value[name]);
    if(encoded !== undefined) wire[key] = encoded;
  }
  return wire;
}

export function decodeShape(shape: Shape, wire: Record<string, unknown>, path: string): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for(const [name, { key, codec }] of Object.entries(shape)) {
    const decoded = codec.decode(wire[key], `${path}.${name}`);
    if(decoded !== undefined) data[name] = decoded;
  }
  return data;
}

// --- пакеты ---

export interface ClientPacket<S extends Shape = Shape> {
  readonly side: "client"
  /** значение ключа ty */
  readonly type: string
  /** игра сама добавит userObjectId и token */
  readonly auth: boolean
  readonly shape: S
}

export interface ServerPacket<S extends Shape = Shape> {
  readonly side: "server"
  /** значение ключа ty; null - пакет без ty (таймер) */
  readonly type: string | null
  readonly shape: S
}

export const clientPacket = <S extends Shape>(type: string, shape: S, options: { auth?: boolean } = {}): ClientPacket<S> =>
  ({ side: "client", type, auth: options.auth ?? false, shape });

export const serverPacket = <S extends Shape>(type: string | null, shape: S): ServerPacket<S> =>
  ({ side: "server", type, shape });

/** поле, которого может не быть в пакете */
export const optionalField = <T>(key: string, codec: Codec<T>): Field<OptionalCodec<T>> => field(key, t.optional(codec));
