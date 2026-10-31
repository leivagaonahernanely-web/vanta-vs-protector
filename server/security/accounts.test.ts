import { describe, expect, it } from "vitest";
import { hashPassword, passwordPolicyError, verifyPassword } from "./password";
import { generateApiKey, hashApiKey, apiKeyHashMatches, isWellFormedApiKey, normalizeDomain, originMatchesDomain } from "./apiKey";

describe("contraseñas", () => {
  it("valida longitud mínima y máxima", () => {
    expect(passwordPolicyError("corta")).toMatch(/al menos/);
    expect(passwordPolicyError("x".repeat(129))).toMatch(/no puede superar/);
    expect(passwordPolicyError("una-clave-larga")).toBeNull();
    expect(passwordPolicyError(undefined)).toMatch(/obligatoria/);
  });

  it("guarda un hash que verifica la contraseña y no la contiene", () => {
    const stored = hashPassword("mi-clave-segura-1");
    expect(stored).not.toContain("mi-clave-segura-1");
    expect(verifyPassword("mi-clave-segura-1", stored)).toBe(true);
    expect(verifyPassword("otra-clave-distinta", stored)).toBe(false);
  });

  it("usa una sal distinta en cada hash", () => {
    expect(hashPassword("misma-clave-123")).not.toBe(hashPassword("misma-clave-123"));
  });

  it("rechaza hashes con formato desconocido", () => {
    expect(verifyPassword("x", "md5$algo")).toBe(false);
  });
});

describe("API keys", () => {
  it("genera claves con formato válido y distintas", () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateApiKey()));
    expect(keys.size).toBe(100);
    for (const k of keys) expect(isWellFormedApiKey(k)).toBe(true);
  });

  it("rechaza caracteres raros y espacios", () => {
    const valid = generateApiKey();
    expect(isWellFormedApiKey(valid + " ")).toBe(false);
    expect(isWellFormedApiKey(valid.replace("nxapi_", "nxapi-"))).toBe(false);
    expect(isWellFormedApiKey(valid.slice(0, -1) + "'")).toBe(false);
    expect(isWellFormedApiKey(valid.slice(0, -1) + "0")).toBe(false);
  });

  it("verifica con HMAC y secreto", () => {
    const key = generateApiKey();
    const stored = hashApiKey(key, "secreto");
    expect(apiKeyHashMatches(key, stored, "secreto")).toBe(true);
    expect(apiKeyHashMatches(key, stored, "otro")).toBe(false);
  });
});

describe("dominio vinculado", () => {
  it("normaliza dominios y rechaza esquemas, rutas y puertos", () => {
    expect(normalizeDomain(" Ejemplo.COM ")).toBe("ejemplo.com");
    expect(normalizeDomain("https://ejemplo.com")).toBeNull();
    expect(normalizeDomain("ejemplo.com/ruta")).toBeNull();
    expect(normalizeDomain("ejemplo.com:8080")).toBeNull();
    expect(normalizeDomain("localhost")).toBeNull();
    expect(normalizeDomain("ejemplo.com'; drop")).toBeNull();
  });

  it("solo acepta https y el host exacto", () => {
    expect(originMatchesDomain("https://ejemplo.com", "ejemplo.com")).toBe(true);
    expect(originMatchesDomain("http://ejemplo.com", "ejemplo.com")).toBe(false);
    expect(originMatchesDomain("https://evil.com", "ejemplo.com")).toBe(false);
    expect(originMatchesDomain("https://ejemplo.com.evil.com", "ejemplo.com")).toBe(false);
    expect(originMatchesDomain("https://sub.ejemplo.com", "ejemplo.com")).toBe(false);
    expect(originMatchesDomain(undefined, "ejemplo.com")).toBe(false);
    expect(originMatchesDomain("no es una url", "ejemplo.com")).toBe(false);
  });
});
