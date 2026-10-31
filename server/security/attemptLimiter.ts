// Limita intentos fallidos (NX_KEY o login) por clave, p. ej. IP o cuenta.
// Tras `maxFailures` fallos dentro de `windowMs`, bloquea y el bloqueo se duplica en cada reincidencia.
export type LimiterOptions = {
  maxFailures: number;
  windowMs: number;
  baseLockMs: number;
  maxLockMs: number;
  now?: () => number;
};

type Entry = { failures: number; windowStart: number; lockedUntil: number; strikes: number };

export class AttemptLimiter {
  private readonly entries = new Map<string, Entry>();
  private readonly opts: LimiterOptions;

  constructor(opts: LimiterOptions) {
    this.opts = opts;
  }

  private clock(): number {
    return this.opts.now ? this.opts.now() : Date.now();
  }

  // Devuelve si se puede intentar y, si no, cuánto falta para volver a intentar.
  check(key: string): { allowed: true } | { allowed: false; retryAfterMs: number } {
    const entry = this.entries.get(key);
    const now = this.clock();
    if (entry && entry.lockedUntil > now) return { allowed: false, retryAfterMs: entry.lockedUntil - now };
    return { allowed: true };
  }

  recordFailure(key: string): void {
    const now = this.clock();
    let entry = this.entries.get(key);
    if (!entry || now - entry.windowStart > this.opts.windowMs) {
      entry = { failures: 0, windowStart: now, lockedUntil: entry?.lockedUntil ?? 0, strikes: entry?.strikes ?? 0 };
      this.entries.set(key, entry);
    }
    entry.failures++;
    if (entry.failures >= this.opts.maxFailures) {
      entry.strikes++;
      const lock = Math.min(this.opts.baseLockMs * 2 ** (entry.strikes - 1), this.opts.maxLockMs);
      entry.lockedUntil = now + lock;
      entry.failures = 0;
      entry.windowStart = now;
    }
  }

  // Un acceso correcto borra el historial de fallos de esa clave.
  recordSuccess(key: string): void {
    this.entries.delete(key);
  }
}
