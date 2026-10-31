// API keys de Premium. Una por cuenta, con regeneración, vinculada a un solo dominio web.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const API_KEY_PREFIX = "nxapi_";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const LENGTH = 40;
export const API_KEY_PATTERN = /^nxapi_[A-HJ-NP-Za-km-z2-9]{40}$/;

export function generateApiKey(): string {
  const chars: string[] = [];
  const limit = 256 - (256 % ALPHABET.length);
  while (chars.length < LENGTH) {
    for (const byte of randomBytes(64)) {
      if (byte < limit && chars.length < LENGTH) chars.push(ALPHABET[byte % ALPHABET.length]);
    }
  }
  return API_KEY_PREFIX + chars.join("");
}

export function isWellFormedApiKey(input: unknown): input is string {
  return typeof input === "string" && API_KEY_PATTERN.test(input);
}

export function hashApiKey(key: string, secret: string): string {
  if (!secret) throw new Error("Falta el secreto para proteger las API keys");
  return createHmac("sha256", secret).update(key, "utf8").digest("hex");
}

export function apiKeyHashMatches(key: string, storedHash: string, secret: string): boolean {
  const a = Buffer.from(hashApiKey(key, secret), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Normaliza un dominio introducido por el usuario: solo nombre de host, sin esquema, ruta ni puerto.
export function normalizeDomain(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim().toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(value)) return null;
  if (value.length > 253) return null;
  return value;
}

// La petición solo se acepta si su Origin apunta exactamente al dominio vinculado.
export function originMatchesDomain(origin: string | undefined, domain: string): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname.toLowerCase() === domain;
  } catch {
    return false;
  }
}
