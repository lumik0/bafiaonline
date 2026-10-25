import { digestHex } from "../common/utils/digest";

export type HashAlgorithm = "SHA-1" | "SHA-256";

/** хеш текста (UTF-8) в hex */
export const hashText = (text: string, algorithm: HashAlgorithm = "SHA-256"): Promise<string> => digestHex(new TextEncoder().encode(text), algorithm);

/** сравнение хешей без учёта регистра */
export const sameHash = (a: string, b: string) => a.trim().toLowerCase() == b.trim().toLowerCase();
