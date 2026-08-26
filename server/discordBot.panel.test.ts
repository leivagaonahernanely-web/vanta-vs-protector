import { describe, expect, it, vi } from "vitest";
import { discordCommands, handleInteraction, hasKeyManagementAccess, panelMessage, respond } from "./discordBot";

describe("Discord access panel", () => {
  it("builds the requested two-row action layout", () => {
    const message = panelMessage();
    const ids = message.components.flatMap((row: any) => row.components.map((button: any) => button.data.custom_id));
    expect(ids).toEqual(["vanta:redeem", "vanta:script", "vanta:role", "vanta:hwid", "vanta:stats"]);
    expect(message.embeds[0].data.title).toBe("Vanta lagger");
    expect(message.embeds[0].data.color).toBe(0x5865f2);
    expect(message.embeds[0].data.description).toContain("Vanta.vs Protector");
    expect(message.embeds[0].data.description).toContain("canjear tu key");
    expect((message as any).ephemeral).not.toBe(true);
  });

  it("uses followUp after acknowledgement and reply only once when public", async () => {
    const reply = vi.fn();
    const followUp = vi.fn();
    await respond({ replied: false, deferred: false, reply, followUp }, { content: "panel" });
    expect(reply).toHaveBeenCalledTimes(1);
    expect(followUp).not.toHaveBeenCalled();
    await respond({ replied: true, deferred: false, reply, followUp }, { content: "second" });
    expect(followUp).toHaveBeenCalledTimes(1);
    const concurrent = { replied: false, deferred: false, reply: vi.fn(() => new Promise((resolve) => setTimeout(resolve, 1))), followUp: vi.fn() };
    await Promise.all([respond(concurrent, { content: "once" }), respond(concurrent, { content: "once" })]);
    expect(concurrent.reply).toHaveBeenCalledTimes(1);
    expect(concurrent.followUp).not.toHaveBeenCalled();
  });

  it("runs the real /panel interaction flow as one public reply", async () => {
    const reply = vi.fn();
    const interaction = { isModalSubmit: () => false, isButton: () => false, isChatInputCommand: () => true, commandName: "panel", replied: false, deferred: false, reply };
    await handleInteraction(interaction);
    expect(reply).toHaveBeenCalledTimes(1);
    const payload = reply.mock.calls[0][0];
    expect(payload.ephemeral).not.toBe(true);
    expect(payload.embeds[0].data.title).toBe("Vanta lagger");
    await handleInteraction(interaction);
    expect(reply).toHaveBeenCalledTimes(1);
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
