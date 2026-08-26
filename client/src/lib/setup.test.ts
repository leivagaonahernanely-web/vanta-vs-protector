import { describe, expect, it } from "vitest";
import { defaultSetup, getDiscordChannelUpdate, getSetupStatus, isValidDiscordChannelId, loadSetupSettings, saveSetupSettings } from "./setup";

function storageMock() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe("Setup settings", () => {
  it("persists and loads script, permissions, trial and channel together", () => {
    const storage = storageMock();
    const settings = { script: "main.lua", permissions: "View Channels, Send Messages", trialDays: "7", channel: "123456789012345678" };
    saveSetupSettings(storage, settings);
    expect(loadSetupSettings(storage)).toEqual(settings);
  });

  it("accepts an empty channel or a valid Discord snowflake, and rejects malformed values", () => {
    expect(isValidDiscordChannelId(defaultSetup.channel)).toBe(true);
    expect(isValidDiscordChannelId("123456789012345678")).toBe(true);
    expect(isValidDiscordChannelId("channel-id")).toBe(false);
  });

  it("exposes the saved, ready and invalid Setup labels", () => {
    expect(getSetupStatus("", false)).toEqual({ kind: "ready", label: "Lista para guardar" });
    expect(getSetupStatus("123456789012345678", true)).toEqual({ kind: "saved", label: "Configuración guardada" });
    expect(getSetupStatus("invalid", false)).toEqual({ kind: "invalid", label: "Canal inválido" });
  });

  it("maps a valid channel to its Discord mutation payload and clears it with null", () => {
    expect(getDiscordChannelUpdate(" 123456789012345678 ")).toEqual({ discordChannelId: "123456789012345678" });
    expect(getDiscordChannelUpdate("   ")).toEqual({ discordChannelId: null });
  });
});
