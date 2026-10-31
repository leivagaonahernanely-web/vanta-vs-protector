// Endpoint REST para usar NextOfuscator desde una web propia con la API key de la cuenta.
// Comprobaciones: formato de la key, plan Premium, Origin igual al dominio vinculado y límite de intentos.
// Nota: Origin lo envían los navegadores, pero un cliente que no sea navegador puede falsificarlo.
// El dominio es una barrera de uso, no un candado criptográfico.
import express, { type Express, type Request, type Response } from "express";
import { ENV } from "./_core/env";
import * as db from "./db";
import { BuildError, buildLua } from "./obfuscator/build";
import { randomInt } from "node:crypto";
import { apiLimiter } from "./security/limits";
import { hashApiKey, isWellFormedApiKey, originMatchesDomain } from "./security/apiKey";

const MAX_BODY_SOURCE = 2_000_000;

export function registerObfuscateApi(app: Express) {
  app.post("/api/v1/obfuscate", express.json({ limit: "3mb" }), async (req: Request, res: Response) => {
    const ipKey = `ip:${req.ip ?? "desconocida"}`;
    if (!apiLimiter.check(ipKey).allowed) {
      res.status(429).json({ error: "Demasiadas peticiones. Espera un momento." });
      return;
    }

    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    if (!isWellFormedApiKey(token)) {
      apiLimiter.recordFailure(ipKey);
      res.status(401).json({ error: "API key no válida." });
      return;
    }

    const user = await db.getUserByApiKeyHash(hashApiKey(token, ENV.keySecret));
    if (!user || user.plan !== "premium" || !user.apiKeyDomain) {
      apiLimiter.recordFailure(ipKey);
      res.status(401).json({ error: "API key no válida." });
      return;
    }

    if (!originMatchesDomain(req.headers.origin, user.apiKeyDomain)) {
      apiLimiter.recordFailure(ipKey);
      res.status(403).json({ error: "Esta API key solo puede usarse desde su dominio vinculado." });
      return;
    }

    const source = (req.body as { source?: unknown } | undefined)?.source;
    if (typeof source !== "string" || source.length === 0 || source.length > MAX_BODY_SOURCE) {
      res.status(400).json({ error: "El campo source es obligatorio y debe ser texto Lua." });
      return;
    }

    apiLimiter.recordSuccess(ipKey);
    try {
      res.json({ code: buildLua(source, randomInt(1, 2 ** 31)).code });
    } catch (error) {
      if (error instanceof BuildError) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }
  });
}
