import { ENV } from "./_core/env";

export type DiscordMessage = { title: string; content: string };

export async function getDiscordBotIdentity(): Promise<{ id: string; username: string } | null> {
  if (!ENV.discordBotToken) return null;
  try {
    const response = await fetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bot ${ENV.discordBotToken}` }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return null;
    const body = await response.json() as { id?: string; username?: string };
    return body.id && body.username ? { id: body.id, username: body.username } : null;
  } catch (error) {
    console.warn("[Discord] Bot identity check failed:", error);
    return null;
  }
}

export async function sendDiscordChannelMessage(channelId: string | undefined, message: DiscordMessage): Promise<boolean> {
  if (!channelId || !/^\d{15,22}$/.test(channelId) || !ENV.discordBotToken) return false;
  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${ENV.discordBotToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: `**${message.title}**\n${message.content}`.slice(0, 2000),
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      console.warn(`[Discord] Channel notification rejected (${response.status})`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Discord] Channel notification failed:", error);
    return false;
  }
}
