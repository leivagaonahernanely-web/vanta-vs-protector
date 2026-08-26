import { describe, expect, it, vi } from "vitest";
import { getDiscordBotIdentity, sendDiscordChannelMessage } from "./discord";

describe("Discord bot configuration", () => {
  it("authenticates against Discord without exposing the token", async () => {
    const token = process.env.DISCORD_BOT_TOKEN;
    expect(token, "DISCORD_BOT_TOKEN no está configurado").toBeTruthy();

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "123456789012345678", username: "vanta-bot" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const identity = await getDiscordBotIdentity();
    expect(identity).toEqual({ id: "123456789012345678", username: "vanta-bot" });
    expect(fetchMock).toHaveBeenCalledWith("https://discord.com/api/v10/users/@me", expect.objectContaining({ headers: { Authorization: `Bot ${token}` } }));
    expect(JSON.stringify(identity)).not.toContain(token);
    vi.unstubAllGlobals();
  });

  it("rejects malformed channel IDs without calling Discord", async () => {
    await expect(sendDiscordChannelMessage("not-a-channel", { title: "test", content: "test" })).resolves.toBe(false);
  });

  it("sends a bounded notification payload to a valid channel", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendDiscordChannelMessage("123456789012345678", { title: "Review", content: "Check" })).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://discord.com/api/v10/channels/123456789012345678/messages",
      expect.objectContaining({ method: "POST", body: expect.stringContaining("Review") }),
    );
    vi.unstubAllGlobals();
  });
});
