// Límites de intentos compartidos por el servidor. Se reinician al reiniciar el proceso;
// con varias instancias deben moverse a la base de datos.
import { AttemptLimiter } from "./attemptLimiter";

const base = { maxFailures: 5, windowMs: 15 * 60_000, baseLockMs: 10 * 60_000, maxLockMs: 24 * 60 * 60_000 };

export const loginLimiter = new AttemptLimiter(base);
export const nxKeyLimiter = new AttemptLimiter(base);
export const apiLimiter = new AttemptLimiter({ maxFailures: 20, windowMs: 60_000, baseLockMs: 60_000, maxLockMs: 15 * 60_000 });
