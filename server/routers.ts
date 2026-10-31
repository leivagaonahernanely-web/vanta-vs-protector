import { TRPCError } from "@trpc/server";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { BuildError, buildLua } from "./obfuscator/build";
import { CompileError } from "./obfuscator/compiler";
import { LuaSyntaxError } from "./obfuscator/lexer";
import { generateApiKey, hashApiKey, normalizeDomain } from "./security/apiKey";
import { hashPassword, passwordPolicyError, verifyPassword } from "./security/password";
import { generateNxKey, hashNxKey, isWellFormedNxKey } from "./security/nxKey";
import { loginLimiter, nxKeyLimiter } from "./security/limits";
import type { User } from "../drizzle/schema";

export const MAX_SOURCE_BYTES = 2_000_000;
const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const GENERIC_LOGIN_ERROR = "Correo o contraseña incorrectos.";

const emailInput = z.string().trim().toLowerCase().max(320).regex(EMAIL_PATTERN, "Correo no válido.");

function clientIp(req: { ip?: string }): string {
  return req.ip ?? "desconocida";
}

// Solo Premium puede usar el ofuscador y las API keys.
function requirePremium(user: User): void {
  if (user.plan !== "premium") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Necesitas una NX_KEY Premium para usar NextOfuscator." });
  }
}

// Datos del usuario que sí puede ver el cliente (sin hashes ni secretos).
function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: user.plan,
    apiKeyDomain: user.apiKeyDomain,
    hasApiKey: Boolean(user.apiKeyHash),
    isOwner: Boolean(ENV.ownerOpenId && user.openId === ENV.ownerOpenId && user.role === "admin"),
  };
}

const obfuscateInput = z.object({
  source: z.string().min(1).max(MAX_SOURCE_BYTES),
});

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts => (opts.ctx.user ? publicUser(opts.ctx.user) : null)),

    // Crear cuenta: exige una NX_KEY de Premium válida y no usada.
    register: publicProcedure
      .input(z.object({ email: emailInput, password: z.string(), nxKey: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const ip = clientIp(ctx.req);
        if (!nxKeyLimiter.check(`ip:${ip}`).allowed) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Demasiados intentos. Espera antes de volver a intentar." });
        }
        const passwordError = passwordPolicyError(input.password);
        if (passwordError) throw new TRPCError({ code: "BAD_REQUEST", message: passwordError });

        if (!isWellFormedNxKey(input.nxKey)) {
          nxKeyLimiter.recordFailure(`ip:${ip}`);
          throw new TRPCError({ code: "BAD_REQUEST", message: "La NX_KEY no tiene un formato válido." });
        }

        const result = await db.createAccountWithNxKey({
          email: input.email,
          passwordHash: hashPassword(input.password),
          keyHash: hashNxKey(input.nxKey, ENV.keySecret),
        });
        if (result === "invalid_key") {
          nxKeyLimiter.recordFailure(`ip:${ip}`);
          throw new TRPCError({ code: "BAD_REQUEST", message: "La NX_KEY no es válida o ya fue usada." });
        }
        if (result === "email_taken") {
          throw new TRPCError({ code: "CONFLICT", message: "No se pudo crear la cuenta con esos datos." });
        }
        nxKeyLimiter.recordSuccess(`ip:${ip}`);
        return { success: true } as const;
      }),

    // Iniciar sesión con correo y contraseña. Límite por IP y por cuenta.
    login: publicProcedure
      .input(z.object({ email: emailInput, password: z.string().max(128) }))
      .mutation(async ({ input, ctx }) => {
        const ipKey = `ip:${clientIp(ctx.req)}`;
        const acctKey = `acct:${input.email}`;
        for (const k of [ipKey, acctKey]) {
          const gate = loginLimiter.check(k);
          if (!gate.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Demasiados intentos. Espera antes de volver a intentar." });
        }

        const user = await db.getUserByEmail(input.email);
        const valid = Boolean(user?.passwordHash && verifyPassword(input.password, user.passwordHash));
        if (!user || !valid) {
          loginLimiter.recordFailure(ipKey);
          loginLimiter.recordFailure(acctKey);
          throw new TRPCError({ code: "UNAUTHORIZED", message: GENERIC_LOGIN_ERROR });
        }
        loginLimiter.recordSuccess(acctKey);

        const token = await sdk.createSessionToken(user.openId, ONE_YEAR_MS);
        ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
        return { success: true } as const;
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Solo el administrador emite NX_KEY. La clave se muestra una sola vez.
  nxKeys: router({
    generate: adminProcedure.mutation(async ({ ctx }) => {
      const key = generateNxKey();
      await db.createNxKey({ keyHash: hashNxKey(key, ENV.keySecret), createdByUserId: ctx.user.id });
      return { key } as const;
    }),
  }),

  // Una API key por cuenta Premium, vinculada a un dominio. Regenerar invalida la anterior.
  apiKeys: router({
    regenerate: protectedProcedure
      .input(z.object({ domain: z.string().max(253) }))
      .mutation(async ({ input, ctx }) => {
        requirePremium(ctx.user);
        const domain = normalizeDomain(input.domain);
        if (!domain) throw new TRPCError({ code: "BAD_REQUEST", message: "Dominio no válido. Usa solo el nombre, por ejemplo ejemplo.com." });
        const key = generateApiKey();
        await db.setUserApiKey(ctx.user.id, { hash: hashApiKey(key, ENV.keySecret), domain });
        return { key, domain } as const;
      }),
  }),

  obfuscator: router({
    // Compila la source Lua y devuelve un archivo autocontenido con la VM y el bytecode.
    run: protectedProcedure.input(obfuscateInput).mutation(({ input, ctx }) => {
      requirePremium(ctx.user);
      try {
        return { code: buildLua(input.source, randomInt(1, 2 ** 31)).code };
      } catch (error) {
        if (error instanceof LuaSyntaxError || error instanceof CompileError || error instanceof BuildError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
