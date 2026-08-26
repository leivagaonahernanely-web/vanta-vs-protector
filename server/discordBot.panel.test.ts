import { describe, expect, it } from "vitest";
import { discordCommands, hasKeyManagementAccess, panelMessage } from "./discordBot";

describe("Discord access panel", () => {
  it("builds the requested two-row action layout", () => {
    const message = panelMessage();
    const ids = message.components.flatMap((row: any) => row.components.map((button: any) => button.data.custom_id));
    expect(ids).toEqual(["vanta:redeem", "vanta:script", "vanta:role", "vanta:hwid", "vanta:stats"]);
    expect(message.embeds[0].data.description).toContain("canjear tu key");
  });

  it("registers slash commands for every panel action", () => {
    const names = discordCommands.map((command: any) => command.name);
    expect(names).toEqual(expect.arrayContaining(["panel", "getscript", "getrole", "redeem", "stats", "resethwid", "generatekeyrol", "generatekey", "deletekey", "whitelist", "unwhitelist"]));
  });

  it("allows key management only to the owner, an administrator or the configured role", () => {
    expect(hasKeyManagementAccess({ actorId: "owner", ownerId: "owner", isAdministrator: false, hasManagerRole: false })).toBe(true);
    expect(hasKeyManagementAccess({ actorId: "admin", ownerId: "owner", isAdministrator: true, hasManagerRole: false })).toBe(true);
    expect(hasKeyManagementAccess({ actorId: "manager", ownerId: "owner", isAdministrator: false, hasManagerRole: true })).toBe(true);
    expect(hasKeyManagementAccess({ actorId: "buyer", ownerId: "owner", isAdministrator: false, hasManagerRole: false })).toBe(false);
  });
});
