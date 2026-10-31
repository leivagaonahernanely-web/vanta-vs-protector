// Sesiones de NextOfuscator: un JWT HS256 firmado con JWT_SECRET, guardado en la cookie de sesión.
import { ForbiddenError } from "@shared/_core/errors";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

function sessionSecret(): Uint8Array {
  if (!ENV.cookieSecret) throw new Error("JWT_SECRET no está configurado");
  return new TextEncoder().encode(ENV.cookieSecret);
}

async function createSessionToken(openId: string, expiresInMs: number = ONE_YEAR_MS): Promise<string> {
  const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
  return new SignJWT({ openId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(expirationSeconds)
    .sign(sessionSecret());
}

async function verifySessionOpenId(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    return typeof payload.openId === "string" && payload.openId.length > 0 ? payload.openId : null;
  } catch {
    console.warn("[Auth] Sesión no válida");
    return null;
  }
}

// Devuelve el usuario de la cookie de sesión o lanza 403.
async function authenticateRequest(req: Request): Promise<User> {
  const token = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME];
  const openId = await verifySessionOpenId(token);
  if (!openId) throw ForbiddenError("Sesión no válida");

  const user = await db.getUserByOpenId(openId);
  if (!user) throw ForbiddenError("Usuario no encontrado");

  await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
  return user;
}

export const sdk = { createSessionToken, authenticateRequest };
