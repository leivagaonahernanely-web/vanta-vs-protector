import { describe, expect, it, vi } from "vitest";
import { sendDiscordChannelMessage } from "./discord";

describe("Discord bot configuration", () => {
  it("authenticates against Discord without exposing the token", async () => {
    const token = process.env.DISCORD_BOT_TOKEN;
    expect(token, "DISCORD_BOT_TOKEN no está configurado").toBeTruthy();

    const response = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token}` },
      signal: AbortSignal.timeout(8_000),
    });

    expect(response.status).toBe(200);
    const body = await response.json() as { id?: string; username?: string; token?: string };
    expect(body.id).toBeTruthy();
    expect(body.token).toBeUndefined();
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
