// Claves NX_KEY de Premium. Formato fijo: NX_KEY-XXXX-XXXX-XXXX-XXXX con A-Z y 2-9
// (sin 0, 1, O ni I para evitar confusiones al copiarlas).
// La comparación es exacta: no se recortan espacios ni se normaliza mayúsculas.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const NX_KEY_PREFIX = "NX_KEY-";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const GROUPS = 4;
const GROUP_LEN = 4;
export const NX_KEY_PATTERN = /^NX_KEY-(?:[A-HJ-NP-Z2-9]{4}-){3}[A-HJ-NP-Z2-9]{4}$/;

// Genera una clave con bytes criptográficos y muestreo sin sesgo.
export function generateNxKey(): string {
  const chars: string[] = [];
  const limit = 256 - (256 % ALPHABET.length); // descarta bytes que causarían sesgo
  while (chars.length < GROUPS * GROUP_LEN) {
    for (const byte of randomBytes(32)) {
      if (byte < limit && chars.length < GROUPS * GROUP_LEN) chars.push(ALPHABET[byte % ALPHABET.length]);
    }
  }
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) groups.push(chars.slice(g * GROUP_LEN, (g + 1) * GROUP_LEN).join(""));
  return NX_KEY_PREFIX + groups.join("-");
}

// Acepta solo texto que cumple el formato exacto. Cualquier otra cosa se rechaza sin consultar nada.
export function isWellFormedNxKey(input: unknown): input is string {
  return typeof input === "string" && input.length === 26 && NX_KEY_PATTERN.test(input);
}

// Las claves se guardan como HMAC con un secreto del servidor, nunca en texto plano.
export function hashNxKey(key: string, secret: string): string {
  if (!secret) throw new Error("Falta el secreto para proteger las claves");
  return createHmac("sha256", secret).update(key, "utf8").digest("hex");
}

export function nxKeyMatches(input: string, storedHash: string, secret: string): boolean {
  const a = Buffer.from(hashNxKey(input, secret), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
