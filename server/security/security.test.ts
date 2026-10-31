import { describe, expect, it } from "vitest";
import { AttemptLimiter } from "./attemptLimiter";
import { generateNxKey, hashNxKey, isWellFormedNxKey, nxKeyMatches } from "./nxKey";

describe("NX_KEY", () => {
  it("genera claves con el formato exacto", () => {
    for (let i = 0; i < 50; i++) {
      const key = generateNxKey();
      expect(isWellFormedNxKey(key)).toBe(true);
      expect(key.startsWith("NX_KEY-")).toBe(true);
    }
  });

  it("genera claves distintas", () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateNxKey()));
    expect(keys.size).toBe(200);
  });

  it("rechaza cualquier entrada que no sea exactamente el formato", () => {
    const valid = "NX_KEY-ABCD-EFGH-JKLM-NPQR";
    expect(isWellFormedNxKey(valid)).toBe(true);
    expect(isWellFormedNxKey(" " + valid)).toBe(false);
    expect(isWellFormedNxKey(valid + " ")).toBe(false);
    expect(isWellFormedNxKey(valid.toLowerCase())).toBe(false);
    expect(isWellFormedNxKey(valid.replace("-", "_"))).toBe(false);
    expect(isWellFormedNxKey(valid.replace("A", "0"))).toBe(false); // 0 no está permitido
    expect(isWellFormedNxKey(valid.replace("A", "'"))).toBe(false);
    expect(isWellFormedNxKey(valid.replace("A", ";"))).toBe(false);
    expect(isWellFormedNxKey(valid + "X")).toBe(false);
    expect(isWellFormedNxKey("NX_KEY-ABCD")).toBe(false);
    expect(isWellFormedNxKey(null)).toBe(false);
    expect(isWellFormedNxKey(12345)).toBe(false);
  });

  it("guarda solo un hash que verifica la clave original", () => {
    const secret = "secreto-del-servidor";
    const key = generateNxKey();
    const stored = hashNxKey(key, secret);
    expect(stored).not.toContain(key);
    expect(nxKeyMatches(key, stored, secret)).toBe(true);
    expect(nxKeyMatches(generateNxKey(), stored, secret)).toBe(false);
    expect(nxKeyMatches(key, stored, "otro-secreto")).toBe(false);
  });

  it("exige un secreto para hashear", () => {
    expect(() => hashNxKey("NX_KEY-ABCD-EFGH-JKLM-NPQR", "")).toThrow();
  });
});

describe("AttemptLimiter", () => {
  const make = (clock: { t: number }) =>
    new AttemptLimiter({ maxFailures: 3, windowMs: 60_000, baseLockMs: 10_000, maxLockMs: 80_000, now: () => clock.t });

  it("permite intentos hasta el límite y luego bloquea", () => {
    const clock = { t: 0 };
    const l = make(clock);
    l.recordFailure("ip");
    l.recordFailure("ip");
    expect(l.check("ip")).toEqual({ allowed: true });
    l.recordFailure("ip");
    expect(l.check("ip")).toEqual({ allowed: false, retryAfterMs: 10_000 });
  });

  it("libera el bloqueo al terminar el tiempo", () => {
    const clock = { t: 0 };
    const l = make(clock);
    for (let i = 0; i < 3; i++) l.recordFailure("ip");
    clock.t = 10_000;
    expect(l.check("ip")).toEqual({ allowed: true });
  });

  it("duplica el bloqueo en cada reincidencia hasta el máximo", () => {
    const clock = { t: 0 };
    const l = make(clock);
    const lockFor = () => {
      for (let i = 0; i < 3; i++) l.recordFailure("ip");
      const r = l.check("ip");
      if (r.allowed) throw new Error("debería estar bloqueado");
      clock.t += r.retryAfterMs;
      return r.retryAfterMs;
    };
    expect([lockFor(), lockFor(), lockFor(), lockFor()]).toEqual([10_000, 20_000, 40_000, 80_000]);
  });

  it("un acceso correcto borra el historial", () => {
    const clock = { t: 0 };
    const l = make(clock);
    l.recordFailure("ip");
    l.recordFailure("ip");
    l.recordSuccess("ip");
    l.recordFailure("ip");
    expect(l.check("ip")).toEqual({ allowed: true });
  });

  it("las claves son independientes", () => {
    const clock = { t: 0 };
    const l = make(clock);
    for (let i = 0; i < 3; i++) l.recordFailure("ip-a");
    expect(l.check("ip-a").allowed).toBe(false);
    expect(l.check("ip-b")).toEqual({ allowed: true });
  });

  it("reinicia el conteo cuando sale de la ventana", () => {
    const clock = { t: 0 };
    const l = make(clock);
    l.recordFailure("ip");
    l.recordFailure("ip");
    clock.t = 61_000;
    l.recordFailure("ip");
    expect(l.check("ip")).toEqual({ allowed: true });
  });
});
