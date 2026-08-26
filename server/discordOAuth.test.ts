import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  linkDiscordIdentity: vi.fn().mockResolvedValue(undefined),
  createContext: vi.fn().mockResolvedValue({ user: { id: 7 } }),
}));

vi.mock("./db", () => ({ linkDiscordIdentity: mocks.linkDiscordIdentity }));
vi.mock("./_core/context", () => ({ createContext: mocks.createContext }));

import { registerDiscordOAuthRoutes } from "./discordOAuth";

type Handler = (req: any, res: any) => Promise<void> | void;

function registeredRoutes() {
  const routes = new Map<string, Handler>();
  const app = { get: (path: string, handler: Handler) => routes.set(path, handler) };
  registerDiscordOAuthRoutes(app as never);
  return routes;
}

function responseMock() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    redirectTarget: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { this.body = value; return this; },
    redirect(value: unknown) { this.redirectTarget = value; return this; },
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };
}

describe("Discord OAuth callback", () => {
  it("rejects malformed or mismatched state before redeeming a code", async () => {
    const routes = registeredRoutes();
    const response = responseMock();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const handler = routes.get("/api/discord/callback");
    await handler?.({ query: { code: "attacker-code", state: "not-valid" }, headers: { cookie: "" } }, response);
    expect(response.statusCode).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("exchanges the code, links the Discord identity, and redirects", async () => {
    const routes = registeredRoutes();
    const nonce = "nonce-for-test";
    const redirectUri = "https://example.com/api/discord/callback";
    const state = Buffer.from(JSON.stringify({ nonce, redirectUri }), "utf8").toString("base64url");
    const response = responseMock();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "111222333444555666", username: "vanta-user", global_name: "Vanta User" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await routes.get("/api/discord/callback")?.(
      { query: { code: "real-code", state }, headers: { cookie: `__Host-discord_oauth_state=${nonce}` } },
      response,
    );

    expect(mocks.linkDiscordIdentity).toHaveBeenCalledWith(7, "111222333444555666", "Vanta User");
    expect(response.redirectTarget).toBe("/?discord=connected");
    expect(response.clearCookie).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
