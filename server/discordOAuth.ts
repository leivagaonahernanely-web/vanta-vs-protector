import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { parse as parseCookie } from "cookie";
import { linkDiscordIdentity } from "./db";
import { createContext } from "./_core/context";
import { ENV } from "./_core/env";

const STATE_COOKIE = "__Host-discord_oauth_state";
const CALLBACK_PATH = "/api/discord/callback";

type DiscordState = { nonce: string; redirectUri: string };
type DiscordTokenResponse = { access_token?: string };
type DiscordUser = { id?: string; username?: string; global_name?: string; avatar?: string | null };

function encodeState(state: DiscordState) {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

function decodeState(value: string): DiscordState | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof parsed?.nonce === "string" && typeof parsed?.redirectUri === "string") return parsed;
  } catch {
    // Invalid attacker-controlled state fails closed.
  }
  return null;
}

function getOrigin(req: Request) {
  const origin = typeof req.query.origin === "string" ? req.query.origin : "";
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && !(url.hostname === "localhost" && url.protocol === "http:")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function registerDiscordOAuthRoutes(app: Express) {
  app.get("/api/discord/start", (req: Request, res: Response) => {
    if (!ENV.vantaClientId || !ENV.vantaClientSecret) {
      res.status(503).json({ error: "Discord OAuth no está configurado." });
      return;
    }
    const origin = getOrigin(req);
    if (!origin) {
      res.status(400).json({ error: "Origin inválido." });
      return;
    }
    const nonce = crypto.randomBytes(24).toString("hex");
    const redirectUri = `${origin}${CALLBACK_PATH}`;
    const state = encodeState({ nonce, redirectUri });
    res.cookie(STATE_COOKIE, nonce, { httpOnly: true, secure: true, sameSite: "none", path: "/", maxAge: 600 });
    const params = new URLSearchParams({ client_id: ENV.vantaClientId, redirect_uri: redirectUri, response_type: "code", scope: "identify email", state });
    res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
  });

  app.get(CALLBACK_PATH, async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const rawState = typeof req.query.state === "string" ? req.query.state : "";
    const state = decodeState(rawState);
    const expectedNonce = parseCookie(req.headers.cookie ?? "")[STATE_COOKIE];
    if (!code || !state || !expectedNonce || state.nonce !== expectedNonce || !state.redirectUri.endsWith(CALLBACK_PATH)) {
      res.status(403).json({ error: "invalid Discord OAuth state" });
      return;
    }
    res.clearCookie(STATE_COOKIE, { httpOnly: true, secure: true, sameSite: "none", path: "/" });

    try {
      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: ENV.vantaClientId, client_secret: ENV.vantaClientSecret, grant_type: "authorization_code", code, redirect_uri: state.redirectUri }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!tokenResponse.ok) throw new Error("Discord token exchange failed");
      const token = await tokenResponse.json() as DiscordTokenResponse;
      if (!token.access_token) throw new Error("Discord access token missing");

      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${token.access_token}` },
        signal: AbortSignal.timeout(8_000),
      });
      if (!userResponse.ok) throw new Error("Discord user request failed");
      const discordUser = await userResponse.json() as DiscordUser;
      if (!discordUser.id || !discordUser.username) throw new Error("Discord identity missing");

      const currentUser = (await createContext({ req, res } as never)).user;
      if (!currentUser) {
        res.redirect("/?discord=login-required");
        return;
      }
      const displayName = discordUser.global_name || discordUser.username;
      const avatarUrl = discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128` : null;
      await linkDiscordIdentity(currentUser.id, discordUser.id, displayName, discordUser.global_name || null, avatarUrl);
      res.redirect("/?discord=connected");
    } catch (error) {
      console.error("[Discord OAuth] Callback failed", error);
      res.status(502).json({ error: "No se pudo conectar Discord." });
    }
  });
}
