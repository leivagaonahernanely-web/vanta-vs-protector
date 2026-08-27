import { describe, expect, it, vi } from "vitest";
import { createReconnectGate, discordCommands, GET_SCRIPT_COPY_BUTTON_LABEL, handleGatewayFailure, handleInteraction, hasKeyManagementAccess, isGuildOwner, mobileViewScriptMessage, panelMessage, parseDuration, respond, scriptRuntimeLoader, targetChoices } from "./discordBot";

describe("Discord access panel", () => {
  it("parses key durations in days, months and years", () => {
    expect(parseDuration("30d")).toBe(30 * 86_400_000);
    expect(parseDuration("3months")).toBe(3 * 2_592_000_000);
    expect(parseDuration("1year")).toBe(31_536_000_000);
    expect(parseDuration("forever")).toBeUndefined();
  });
  it("builds FFA and protected runtime loaders according to the panel access rule", () => {
    const ffa = scriptRuntimeLoader({ slug: "ffa-script", ffaMode: true, scriptKey: "1234567890" });
    const protectedLoader = scriptRuntimeLoader({ slug: "protected-script", ffaMode: false, scriptKey: "1234567890" });
    expect(ffa).not.toContain("script_key");
    expect(ffa).toContain("/scripts/hosted/ffa-script");
    expect(protectedLoader).toContain('script_key = "1234567890"');
    expect(protectedLoader).toContain("?key=1234567890");
    expect(protectedLoader).toContain("RbxAnalyticsService");
  });

  it("labels the Get Script copy action for mobile users", () => {
    expect(GET_SCRIPT_COPY_BUTTON_LABEL).toBe("Mobile View Script");
  });

  it("uses the active license key when building a protected Get Script loader", () => {
    const loader = scriptRuntimeLoader({ slug: "bound-script", ffaMode: false, scriptKey: "internal-script-key" }, "86vC3ZULuEQpOImpm5VBB6oLROAQmPLe");
    expect(loader).toContain('script_key = "86vC3ZULuEQpOImpm5VBB6oLROAQmPLe"');
    expect(loader).toContain("?key=86vC3ZULuEQpOImpm5VBB6oLROAQmPLe");
    expect(loader).not.toContain("internal-script-key");
    expect(loader).toContain("&hwid=\" .. hwid");
  });

  it("builds Mobile View Script as exactly two compact lines", () => {
    const loader = scriptRuntimeLoader({ slug: "mobile-script", ffaMode: false, scriptKey: "internal-key" }, "mbe2krjut4gdyiggoqc3t47zq3eaxnkl", 42);
    const message = mobileViewScriptMessage({ name: "Vanta.vs", slug: "mobile-script", ffaMode: false }, "mbe2krjut4gdyiggoqc3t47zq3eaxnkl", 42);
    expect(loader.split("\n")).toHaveLength(2);
    expect(loader).toContain('/scripts/loaders/');
    expect(loader).not.toContain("RbxAnalyticsService");
    expect(loader).not.toContain("/scripts/hosted/");
    expect(message).toContain("``lua");
    expect(message).toContain("\n``");
    expect(message).not.toContain("```lua");
  });

  it("builds the requested two-row action layout", () => {
    const message = panelMessage();
    const ids = message.components.flatMap((row: any) => row.components.map((button: any) => button.data.custom_id));
    expect(ids).toEqual(["vanta:redeem", "vanta:get-key", "vanta:script", "vanta:role", "vanta:hwid", "vanta:stats"]);
    expect(discordCommands.some((command: any) => command.name === "apikey")).toBe(true);
    expect(message.embeds[0].data.title).toBe("Vanta.vs Protector · Access Panel");
    expect(message.embeds[0].data.color).toBe(0x5865f2);
    expect(message.embeds[0].data.description).toContain("Vanta.vs Protector");
    expect(message.embeds[0].data.description).toContain("canjear tu key");
    expect((message as any).ephemeral).not.toBe(true);
  });

  it("schedules only one post-disconnect reconnect and clears its pending state", () => {
    vi.useFakeTimers();
    const reconnect = vi.fn();
    const gate = createReconnectGate(reconnect, 5000);
    expect(gate.schedule()).toBe(true);
    expect(gate.schedule()).toBe(false);
    expect(gate.pending()).toBe(true);
    vi.advanceTimersByTime(4999);
    expect(reconnect).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(reconnect).toHaveBeenCalledTimes(1);
    expect(gate.pending()).toBe(false);
    expect(gate.schedule()).toBe(true);
    gate.cancel();
    vi.useRealTimers();
  });

  it("routes both Gateway error and shard disconnect through one recovery callback", () => {
    const reconnect = vi.fn(() => true);
    expect(handleGatewayFailure("Gateway error", reconnect)).toBe(true);
    expect(handleGatewayFailure("Gateway desconectado", reconnect)).toBe(true);
    expect(reconnect).toHaveBeenCalledTimes(2);
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

  it("rejects /panel when the Discord owner is not linked", async () => {
    const reply = vi.fn();
    const interaction = { isModalSubmit: () => false, isButton: () => false, isChatInputCommand: () => true, commandName: "panel", user: { id: "not-linked" }, replied: false, deferred: false, reply };
    await handleInteraction(interaction);
    expect(reply).toHaveBeenCalledTimes(1);
    const payload = reply.mock.calls[0][0];
    expect(payload.ephemeral).toBe(true);
    expect(payload.content).toContain("owner vinculado");
  });

  it("runs /updates as a public styled embed", async () => {
    const reply = vi.fn();
    const interaction = { isModalSubmit: () => false, isButton: () => false, isChatInputCommand: () => true, commandName: "updates", replied: false, deferred: false, reply };
    await handleInteraction(interaction);
    expect(reply).toHaveBeenCalledTimes(1);
    const embed = reply.mock.calls[0][0].embeds[0].data;
    expect(embed.title).toBe("Project Updates");
    expect(embed.color).toBe(0xe93540);
  });

  it("registers slash commands for every panel action", () => {
    const names = discordCommands.map((command: any) => command.name);
    expect(names).toEqual(["ping", "panel", "stats", "apikey", "getscript", "getkey", "getrole", "redeem", "generatekey", "deletekey", "whitelabel", "unwhitelist", "blacklist", "resethwid", "addtime", "warn", "dropkey", "prices", "updates", "generatekeyrol"]);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("getscript");
    expect(names).toContain("getrole");
    expect(names).toContain("stats");
    expect(names).toContain("apikey");
    expect(names).toContain("redeem");
    expect(names).toContain("updates");
  });

  it("exposes the requested required and optional slash options", () => {
    const command = (name: string) => discordCommands.find((item: any) => item.name === name) as any;
    const options = (name: string) => command(name).options;
    expect(options("generatekey").find((item: any) => item.name === "script").required).toBe(true);
    expect(options("generatekey").find((item: any) => item.name === "duration").required).toBe(false);
    expect(options("getrole")).toHaveLength(1);
    expect(options("getrole")[0].name).toBe("role");
    expect(options("getrole")[0].type).toBe(8);
    expect(options("getrole")[0].required).toBe(true);
    expect(options("deletekey").find((item: any) => item.name === "key").required).toBe(true);
    expect(options("deletekey").find((item: any) => item.name === "user").required).toBe(false);
    expect(options("whitelabel").find((item: any) => item.name === "kind").required).toBe(true);
    expect(options("whitelabel")).toHaveLength(3);
    expect(options("whitelabel").find((item: any) => item.name === "script").autocomplete).toBe(true);
    expect(options("whitelabel").find((item: any) => item.name === "script").required).toBe(true);
    expect(options("whitelabel").find((item: any) => item.name === "target").required).toBe(true);
    expect(options("whitelabel").find((item: any) => item.name === "target").autocomplete).toBe(true);
    expect(options("unwhitelist")).toHaveLength(3);
    expect(options("unwhitelist").find((item: any) => item.name === "script").autocomplete).toBe(true);
    expect(options("unwhitelist").find((item: any) => item.name === "target").required).toBe(true);
    expect(options("blacklist").find((item: any) => item.name === "script").required).toBe(true);
    expect(options("blacklist").find((item: any) => item.name === "user").required).toBe(true);
    expect(options("resethwid").find((item: any) => item.name === "script").required).toBe(true);
    expect(options("resethwid").find((item: any) => item.name === "user").required).toBe(true);
    expect(options("addtime").every((item: any) => item.required)).toBe(true);
    expect(options("warn").every((item: any) => item.required)).toBe(true);
    expect(options("dropkey").find((item: any) => item.name === "amount").required).toBe(true);
  });

  it("autocompletes guild users and roles based on the selected kind", async () => {
    const members = new Map([
      ["u1", { user: { id: "u1", username: "hernan" }, displayName: "Hernán" }],
      ["u2", { user: { id: "u2", username: "other" }, displayName: "Other" }],
    ]);
    const roles = new Map([
      ["r1", { id: "r1", name: "Premium" }],
      ["r2", { id: "r2", name: "Staff" }],
    ]);
    const make = (kind: string, focused: string) => ({ guildId: "guild", options: { getString: () => kind, getFocused: () => ({ name: "target", value: focused }) }, guild: { members: { cache: members }, roles: { cache: roles } } });
    expect(await targetChoices(make("user", "hern"))).toEqual([{ name: "User · Hernán", value: "user:u1" }]);
    expect(await targetChoices(make("role", "prem"))).toEqual([{ name: "Role · Premium", value: "role:r1" }]);
  });

  it("recognizes the Discord guild owner independently from the linked database identity", () => {
    expect(isGuildOwner({ actorId: "guild-owner", guildOwnerId: "guild-owner" })).toBe(true);
    expect(isGuildOwner({ actorId: "other-user", guildOwnerId: "guild-owner" })).toBe(false);
    expect(isGuildOwner({ actorId: "guild-owner", guildOwnerId: null })).toBe(false);
  });

  it("allows key management only to the owner, an administrator or the configured role", () => {
    expect(hasKeyManagementAccess({ actorId: "owner", ownerId: "owner", isAdministrator: false, hasManagerRole: false })).toBe(true);
    expect(hasKeyManagementAccess({ actorId: "admin", ownerId: "owner", isAdministrator: true, hasManagerRole: false })).toBe(true);
    expect(hasKeyManagementAccess({ actorId: "manager", ownerId: "owner", isAdministrator: false, hasManagerRole: true })).toBe(true);
    expect(hasKeyManagementAccess({ actorId: "buyer", ownerId: "owner", isAdministrator: false, hasManagerRole: false })).toBe(false);
  });
});
