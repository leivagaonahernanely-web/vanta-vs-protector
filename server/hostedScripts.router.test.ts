import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  createHostedScript: vi.fn(),
  getHostedScriptsByUser: vi.fn(),
  buildProtectionArtifact: vi.fn(() => ({ code: "-- protected artifact", status: "protected", checksum: "abc123", message: "OK" })),
}));

vi.mock("./db", () => ({
  createHostedScript: mocks.createHostedScript,
  getHostedScriptsByUser: mocks.getHostedScriptsByUser,
  createProtection: vi.fn(),
  getProtectionsByUser: vi.fn(),
  updateDiscordChannelId: vi.fn(),
}));
vi.mock("./protection", () => ({ getProviderStatus: vi.fn(() => ({ configured: true })), protectWithAdapter: vi.fn(async (...args: Parameters<typeof mocks.buildProtectionArtifact>) => mocks.buildProtectionArtifact(...args)) }));

import { appRouter } from "./routers";

const user = { id: 12, openId: "host-user", name: "Host User", email: "host@example.com", loginMethod: "manus", role: "user" as const, discordChannelId: null, discordUserId: null, discordUsername: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
function context(withUser = true): TrpcContext {
  return { user: withUser ? user : null, req: { protocol: "https", get: () => "vanta.test", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

const hostedRow = { id: 3, userId: 12, slug: "Abc123456789xyz", name: "demo.lua", description: "demo", ffaMode: 1, code: "-- protected artifact", createdAt: new Date("2026-08-26T00:00:00Z"), updatedAt: new Date("2026-08-26T00:00:00Z") };

describe("hostedScripts router", () => {
  it("creates a hosted script and returns a stable URL and loader", async () => {
    mocks.createHostedScript.mockResolvedValue(hostedRow);
    const result = await appRouter.createCaller(context()).hostedScripts.create({ name: "demo.lua", description: "demo", source: "print('ok')", ffaMode: true, obfuscateSource: true });
    expect(result.url).toBe("https://vanta.test/scripts/hosted/Abc123456789xyz");
    expect(result.loader).toContain("loadstring(game:HttpGet(\"https://vanta.test/scripts/hosted/Abc123456789xyz\"))()");
    expect(mocks.createHostedScript).toHaveBeenCalledWith(expect.objectContaining({ userId: 12, name: "demo.lua", ffaMode: 1, code: "-- protected artifact" }));
  });

  it("lists only the authenticated user's hosted scripts", async () => {
    mocks.getHostedScriptsByUser.mockResolvedValue([hostedRow]);
    const result = await appRouter.createCaller(context()).hostedScripts.list();
    expect(mocks.getHostedScriptsByUser).toHaveBeenCalledWith(12);
    expect(result[0]?.slug).toBe(hostedRow.slug);
    expect(result[0]?.loader).toContain("/scripts/hosted/");
  });

  it("rejects unauthenticated creation and listing", async () => {
    const caller = appRouter.createCaller(context(false));
    await expect(caller.hostedScripts.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.hostedScripts.create({ name: "demo.lua", source: "return true", ffaMode: false, obfuscateSource: true })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
