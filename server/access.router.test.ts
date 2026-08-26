import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  createLicense: vi.fn(),
  getLicensesByOwner: vi.fn().mockResolvedValue([]),
  createBlacklist: vi.fn(),
  getBlacklistsByOwner: vi.fn().mockResolvedValue([]),
  createAccessRule: vi.fn(),
  getAccessRulesByOwner: vi.fn().mockResolvedValue([]),
  resetLicenseHwid: vi.fn(),
  revokeLicense: vi.fn(),
  deleteLicense: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, ...dbMocks };
});

const user = { id: 7, openId: "access-user", name: "Owner", email: "owner@example.com", loginMethod: "manus", role: "admin" as const, discordChannelId: null, discordUserId: null, discordUsername: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
const context = { user, req: { protocol: "https", headers: {}, get: () => "vanta.test" } as TrpcContext["req"], res: {} as TrpcContext["res"] };

beforeEach(() => vi.clearAllMocks());

describe("access management", () => {
  it("generates a ten digit automatic license key", async () => {
    dbMocks.createLicense.mockResolvedValue({ id: 1, ownerId: 7, keyCode: "1234567890", type: "license", status: "active", hostedScriptId: null, discordUserId: null, hwid: null, expiresAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
    const result = await appRouter.createCaller(context).licenseKeys.generate({ type: "license", trialDays: 3 });
    expect(result.keyCode).toMatch(/^\d{10}$/);
    expect(dbMocks.createLicense).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 7, type: "license", status: "active", keyCode: expect.stringMatching(/^\d{10}$/) }));
  });

  it("rejects non-admin key generation", async () => {
    const regularUser = { ...user, role: "user" as const };
    await expect(appRouter.createCaller({ ...context, user: regularUser }).licenseKeys.generate({ type: "license", plan: "free", trialDays: 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires authentication for license management", async () => {
    const unauthenticated = { ...context, user: null } as unknown as TrpcContext;
    await expect(appRouter.createCaller(unauthenticated).licenseKeys.generate({ type: "license", plan: "free", trialDays: 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("resets HWID, revokes, and deletes only through owner-scoped mutations", async () => {
    const caller = appRouter.createCaller(context);
    await caller.licenseKeys.resetHwid({ id: 9 });
    await caller.licenseKeys.revoke({ id: 9 });
    await caller.licenseKeys.remove({ id: 9 });
    expect(dbMocks.resetLicenseHwid).toHaveBeenCalledWith(7, 9);
    expect(dbMocks.revokeLicense).toHaveBeenCalledWith(7, 9);
    expect(dbMocks.deleteLicense).toHaveBeenCalledWith(7, 9);
  });

  it("creates blacklist and whitelist rules for the authenticated owner", async () => {
    dbMocks.createBlacklist.mockResolvedValue({ id: 3, ownerId: 7, discordUserId: "123456789012345678", reason: "abuse", active: 1 });
    dbMocks.createAccessRule.mockResolvedValue({ id: 4, ownerId: 7, kind: "role", discordId: "123456789012345679", label: "VIP", active: 1 });
    await appRouter.createCaller(context).access.blacklist.add({ discordUserId: "123456789012345678", reason: "abuse" });
    await appRouter.createCaller(context).access.whitelist.add({ kind: "role", discordId: "123456789012345679", label: "VIP" });
    expect(dbMocks.createBlacklist).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 7, discordUserId: "123456789012345678" }));
    expect(dbMocks.createAccessRule).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 7, kind: "role" }));
  });
});
