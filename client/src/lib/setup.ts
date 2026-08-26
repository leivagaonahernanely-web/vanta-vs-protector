export type SetupSettings = {
  script: string;
  permissions: string;
  trialDays: string;
  channel: string;
};

export const defaultSetup: SetupSettings = {
  script: "",
  permissions: "View Channels, Send Messages",
  trialDays: "3",
  channel: "",
};

export function isValidDiscordChannelId(value: string) {
  return value.trim() === "" || /^\d{15,22}$/.test(value.trim());
}

export function loadSetupSettings(storage: Pick<Storage, "getItem">): SetupSettings {
  return {
    script: storage.getItem("vanta.setup.script") ?? defaultSetup.script,
    permissions: storage.getItem("vanta.setup.permissions") ?? defaultSetup.permissions,
    trialDays: storage.getItem("vanta.setup.trialDays") ?? defaultSetup.trialDays,
    channel: storage.getItem("vanta.setup.channel") ?? defaultSetup.channel,
  };
}

export function saveSetupSettings(storage: Pick<Storage, "setItem">, settings: SetupSettings) {
  storage.setItem("vanta.setup.script", settings.script);
  storage.setItem("vanta.setup.permissions", settings.permissions);
  storage.setItem("vanta.setup.trialDays", settings.trialDays);
  storage.setItem("vanta.setup.channel", settings.channel);
}

export function getSetupStatus(channel: string, saved: boolean) {
  if (!isValidDiscordChannelId(channel)) return { kind: "invalid" as const, label: "Canal inválido" };
  if (saved) return { kind: "saved" as const, label: "Configuración guardada" };
  return { kind: "ready" as const, label: "Lista para guardar" };
}

export function getDiscordChannelUpdate(channel: string) {
  return { discordChannelId: channel.trim() || null };
}

export function clearRejectedDiscordChannel(storage: Pick<Storage, "setItem">, settings: SetupSettings) {
  const next = { ...settings, channel: "" };
  saveSetupSettings(storage, next);
  return next;
}
