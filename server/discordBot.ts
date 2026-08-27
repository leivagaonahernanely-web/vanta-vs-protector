import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  PermissionFlagsBits,
  REST,
  Role,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { durationToMs } from "../shared/duration";
import { buildPlansDescription } from "../shared/plans";
import { ENV } from "./_core/env";
import { makeLoaderToken } from "./loaderTokens";
import {
  createAccessRuleIfAbsent,
  createBlacklist,
  createKeyAuditLog,
  createWarning,
  addTimeToLicense,
  deleteAccessRuleByDiscordId,
  getAccessRulesByOwner,
  createLicense,
  deleteLicenseByKeyCode,
  getKeyManagerRoleId,
  getHostedScriptByName,
  getHostedScriptById,
  getHostedScriptsByUser,
  getLicensesByOwner,
  getActiveLicensesByDiscordUserId,
  getApiKeyByDiscordUserId,
  ensureUserApiKey,
  linkDiscordIdentity,
  getBuyerRoleId,
  setBuyerRoleId,
  getUserByDiscordUserId,
  getUserByOpenId,
  redeemLicense,
  resetLicenseHwidByDiscordUserId,
  setKeyManagerRole,
} from "./db";
import { randomInt } from "node:crypto";

const PANEL_URL = "https://vanta-prot-hfw5hmym.manus.space";
export const GET_SCRIPT_COPY_BUTTON_LABEL = "Mobile View Script";
export const discordCommands = [
  new SlashCommandBuilder().setName("ping").setDescription("Verifica la latencia del bot").toJSON(),
  new SlashCommandBuilder().setName("panel").setDescription("Publica el panel de Vanta.vs Protector").toJSON(),
  new SlashCommandBuilder().setName("stats").setDescription("Muestra el estado del acceso").toJSON(),
  new SlashCommandBuilder().setName("apikey").setDescription("Muestra la API key de tu cuenta vinculada").toJSON(),
  new SlashCommandBuilder().setName("getscript").setDescription("Obtiene el enlace de acceso al script").toJSON(),
  new SlashCommandBuilder().setName("getkey").setDescription("Entrega la key automática si estás en la whitelist").toJSON(),
  new SlashCommandBuilder().setName("getrole").setDescription("Configura el rol que recibirá un usuario con key activa").addRoleOption(o => o.setName("role").setDescription("Rol comprador").setRequired(true)).toJSON(),
  new SlashCommandBuilder().setName("redeem").setDescription("Canjea una key de acceso").addStringOption(o => o.setName("key").setDescription("Key alfanumérica de mínimo 32 caracteres").setRequired(true)).toJSON(),
  new SlashCommandBuilder().setName("generatekey").setDescription("Genera una key aleatoria para un script hosteado").addStringOption(o => o.setName("script").setDescription("Script hosteado").setAutocomplete(true).setRequired(true)).addStringOption(o => o.setName("duration").setDescription("Duración; vacío = forever").setRequired(false)).toJSON(),
  new SlashCommandBuilder().setName("deletekey").setDescription("Elimina una key").addStringOption(o => o.setName("key").setDescription("Key a eliminar").setRequired(true)).addUserOption(o => o.setName("user").setDescription("Usuario opcional").setRequired(false)).addRoleOption(o => o.setName("role").setDescription("Rol opcional").setRequired(false)).toJSON(),
  new SlashCommandBuilder().setName("whitelabel").setDescription("Añade un usuario o rol a la whitelist").addStringOption(o => o.setName("script").setDescription("Script hosteado").setAutocomplete(true).setRequired(true)).addStringOption(o => o.setName("kind").setDescription("User o Role").addChoices({ name: "User", value: "user" }, { name: "Role", value: "role" }).setRequired(true)).addStringOption(o => o.setName("target").setDescription("Selecciona el usuario o rol").setAutocomplete(true).setRequired(true)).toJSON(),
  new SlashCommandBuilder().setName("unwhitelist").setDescription("Retira un usuario o rol de la whitelist").addStringOption(o => o.setName("script").setDescription("Script hosteado").setAutocomplete(true).setRequired(true)).addStringOption(o => o.setName("kind").setDescription("User o Role").addChoices({ name: "User", value: "user" }, { name: "Role", value: "role" }).setRequired(true)).addStringOption(o => o.setName("target").setDescription("Selecciona el usuario o rol").setAutocomplete(true).setRequired(true)).toJSON(),
  new SlashCommandBuilder().setName("blacklist").setDescription("Bloquea un usuario para un script").addStringOption(o => o.setName("script").setDescription("Script objetivo").setRequired(true)).addUserOption(o => o.setName("user").setDescription("Usuario obligatorio").setRequired(true)).addStringOption(o => o.setName("reason").setDescription("Razón").setRequired(false)).toJSON(),
  new SlashCommandBuilder().setName("resethwid").setDescription("Reinicia el HWID de un usuario").addStringOption(o => o.setName("script").setDescription("Script objetivo").setRequired(true)).addUserOption(o => o.setName("user").setDescription("Usuario obligatorio").setRequired(true)).toJSON(),
  new SlashCommandBuilder().setName("addtime").setDescription("Añade tiempo a una key").addStringOption(o => o.setName("key").setDescription("Key obligatoria").setRequired(true)).addStringOption(o => o.setName("duration").setDescription("Tiempo a añadir").setRequired(true)).toJSON(),
  new SlashCommandBuilder().setName("warn").setDescription("Advierte a un usuario").addUserOption(o => o.setName("user").setDescription("Usuario obligatorio").setRequired(true)).addStringOption(o => o.setName("reason").setDescription("Razón obligatoria").setRequired(true)).toJSON(),
  new SlashCommandBuilder().setName("dropkey").setDescription("Genera un drop de keys").addIntegerOption(o => o.setName("amount").setDescription("Cantidad de keys").setRequired(true).setMinValue(1).setMaxValue(50)).toJSON(),
  new SlashCommandBuilder().setName("prices").setDescription("Publica la información de precios").toJSON(),
  new SlashCommandBuilder().setName("updates").setDescription("Publica una actualización del proyecto").toJSON(),
  new SlashCommandBuilder().setName("generatekeyrol").setDescription("Configura el rol autorizado para gestionar keys").addRoleOption(o => o.setName("role").setDescription("Rol delegado").setRequired(true)).toJSON(),
];

let started = false;
let gatewayOnline = false;
let client: Client | null = null;
export function createReconnectGate(schedule: () => void, delayMs = 5_000) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule() { if (timer) return false; timer = setTimeout(() => { timer = null; schedule(); }, delayMs); return true; },
    cancel() { if (timer) clearTimeout(timer); timer = null; },
    pending() { return timer !== null; },
  };
}
export function getDiscordGatewayStatus() { return { online: gatewayOnline, configured: Boolean(ENV.discordBotToken), username: client?.user?.username ?? null }; }
const reconnectGate = createReconnectGate(() => { if (!started) startDiscordBot(); });
function scheduleReconnect() { if (!ENV.discordBotToken) return false; return reconnectGate.schedule(); }
export function handleGatewayFailure(reason: string, reconnect: () => boolean = scheduleReconnect) {
  gatewayOnline = false;
  started = false;
  console.warn(`[Discord Bot] ${reason}; reintentando en 5 segundos.`);
  client?.destroy();
  client = null;
  return reconnect();
}
const keyActionTimestamps = new Map<string, number>();
const KEY_ACTION_COOLDOWN_MS = 10_000;
const respondedInteractions = new WeakSet<object>();
const scriptChoiceCache = new Map<number, { expiresAt: number; scripts: any[] }>();
const SCRIPT_CHOICE_CACHE_MS = 15_000;
const SCRIPT_CHOICE_TIMEOUT_MS = 2_500;

const KEY_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function keyCode() { let key = ""; for (let index = 0; index < 32; index += 1) key += KEY_ALPHABET[randomInt(0, KEY_ALPHABET.length)]; return key; }
function memberHasRole(interaction: ButtonInteraction | any, roleId: string | undefined) {
  if (!roleId) return false;
  const roles = interaction.member?.roles;
  return Array.isArray(roles) ? roles.includes(roleId) : Boolean(roles?.cache?.has(roleId));
}
export function hasKeyManagementAccess(input: { actorId: string; ownerId?: string | null; isAdministrator: boolean; hasManagerRole: boolean }) {
  const actorId = String(input.actorId ?? "").trim();
  const ownerId = String(input.ownerId ?? "").trim();
  return Boolean(ownerId && (actorId === ownerId || input.isAdministrator || input.hasManagerRole));
}
export function matchesWhitelistRule(rule: { kind: "user" | "role"; discordId: string; active?: number | null; hostedScriptId?: number | null }, discordUserId: string, roleIds: string[]) {
  if (rule.active === 0 || !rule.hostedScriptId) return false;
  return rule.kind === "user" ? rule.discordId === discordUserId : roleIds.includes(rule.discordId);
}
export function isGuildOwner(input: { actorId: string; guildOwnerId?: string | null }) {
  return Boolean(input.guildOwnerId && input.actorId === input.guildOwnerId);
}
function normalizeDiscordIdentity(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}
export function isConfiguredOwnerId(input: { actorId: unknown; linkedDiscordUserId?: unknown | null }) {
  const actorId = normalizeDiscordIdentity(input.actorId);
  const linkedDiscordUserId = normalizeDiscordIdentity(input.linkedDiscordUserId);
  return Boolean(actorId && linkedDiscordUserId && actorId === linkedDiscordUserId);
}
async function ownerAccount(interaction?: any) {
  const configuredOwner = ENV.ownerOpenId ? await getUserByOpenId(ENV.ownerOpenId) : undefined;
  if (configuredOwner) return configuredOwner;
  const actorId = normalizeDiscordIdentity(interaction?.user?.id);
  if (!actorId) return undefined;
  const linkedAdmin = await getUserByDiscordUserId(actorId);
  return linkedAdmin?.role === "admin" ? linkedAdmin : undefined;
}
async function warmScriptChoiceCache() {
  try {
    const owner = await ownerAccount();
    if (!owner) return;
    const scripts = await getHostedScriptsByUser(owner.id);
    scriptChoiceCache.set(owner.id, { expiresAt: Date.now() + SCRIPT_CHOICE_CACHE_MS, scripts });
    console.log(`[Discord Bot] Autocomplete de scripts listo: ${scripts.length} script(s) cargado(s).`);
  } catch (error) {
    console.warn("[Discord Bot] No se pudo precargar el autocomplete de scripts:", error instanceof Error ? error.message : "unknown error");
  }
}
async function isConfiguredOwner(interaction: any) {
  const owner = await ownerAccount(interaction);
  if (!owner) return false;
  if (isConfiguredOwnerId({ actorId: interaction.user?.id, linkedDiscordUserId: owner.discordUserId })) return true;
  // Bootstrap only when the owner account has not been linked yet. This keeps
  // whitelist administration owner-only without allowing an arbitrary member.
  if (!normalizeDiscordIdentity(owner.discordUserId) && isGuildOwner({ actorId: String(interaction.user?.id ?? ""), guildOwnerId: interaction.guild?.ownerId })) {
    await linkDiscordIdentity(owner.id, String(interaction.user.id), interaction.user.globalName || interaction.user.username || "Discord owner", interaction.user.globalName || null, interaction.user.displayAvatarURL?.({ extension: "png", size: 128 }) ?? null);
    return true;
  }
  return false;
}
async function canManageKeys(interaction: any) {
  const owner = await ownerAccount(interaction);
  if (!owner) return { allowed: false, owner: undefined };
  const managerRole = await getKeyManagerRoleId(owner.id);
  const actorIsConfiguredOwner = await isConfiguredOwner(interaction);
  const actorIsGuildOwner = isGuildOwner({ actorId: String(interaction.user?.id ?? ""), guildOwnerId: interaction.guild?.ownerId });
  const isAdministrator = Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator));
  const hasManagerRole = memberHasRole(interaction, managerRole);
  return { allowed: actorIsConfiguredOwner || actorIsGuildOwner || hasKeyManagementAccess({ actorId: interaction.user?.id, ownerId: owner.discordUserId, isAdministrator, hasManagerRole }), owner };
}
export async function respond(interaction: any, payload: any) {
  const target = interaction as object;
  if (respondedInteractions.has(target)) return undefined;
  respondedInteractions.add(target);
  if (interaction.replied || interaction.deferred) return interaction.followUp(payload);
  return interaction.reply(payload);
}
export function mobileViewScriptMessage(script: any, accessKey: string, licenseId: number) {
  return `📜 **${script.name}**\n\n\`\`lua\n${scriptRuntimeLoader(script, accessKey, licenseId)}\n\`\``;
}

export function scriptRuntimeLoader(script: any, accessKey?: string, licenseId?: number) {
  const url = `${PANEL_URL}/scripts/hosted/${script.slug}`;
  const runtimeKey = script.ffaMode ? "trial" : (accessKey || script.scriptKey);
  if (!script.ffaMode && accessKey && licenseId) {
    const compactUrl = `${PANEL_URL}/scripts/loaders/${makeLoaderToken(licenseId, accessKey)}`;
    return `script_key = "${accessKey}"\nloadstring(game:HttpGet("${compactUrl}"))()`;
  }
  const accessUrl = runtimeKey ? `${url}?key=${encodeURIComponent(runtimeKey)}` : url;
  const load = script.ffaMode || !runtimeKey
    ? `loadstring(game:HttpGet("${accessUrl}"))()`
    : `local hwid = game:GetService("RbxAnalyticsService"):GetClientId()\nloadstring(game:HttpGet("${accessUrl}&hwid=" .. hwid))()`;
  return !script.ffaMode && runtimeKey ? `script_key = "${runtimeKey}"\n${load}` : load;
}

export function panelMessage() {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Vanta.vs Protector · Access Panel")
    .setDescription("Este panel de control es para el proyecto: **Vanta.vs Protector**\n\nSi eres comprador, utiliza los botones de abajo para canjear tu key, obtener el script autorizado o conseguir tu rol.")
    .setFooter({ text: "Vanta.vs Protector · Panel de acceso" })
    .setTimestamp();
  const rowOne = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("vanta:redeem").setLabel("🔑 Redeem Key").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("vanta:get-key").setLabel("🔐 Get Key").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("vanta:script").setLabel("📜 Get Script").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("vanta:role").setLabel("👤 Get Role").setStyle(ButtonStyle.Primary),
  );
  const rowTwo = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("vanta:hwid").setLabel("⚙️ Reset HWID").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("vanta:stats").setLabel("📊 Get Stats").setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [rowOne, rowTwo] };
}

export async function publishUpdatesMessage(channelId: string, config: { title: string; description: string }) {
  if (!client || !gatewayOnline) throw new Error("El Gateway Discord no está conectado.");
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased() || !("send" in channel)) throw new Error("El canal Discord no permite mensajes.");
  const title = config.title.trim();
  const description = config.description.trim();
  if (!title || !description) throw new Error("El título y el contenido de la actualización son obligatorios.");
  const embed = new EmbedBuilder()
    .setColor(0xe93540)
    .setAuthor({ name: `${title} · APP` })
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: `Actualización · ${new Date().getFullYear()} | Vanta.vs Protector` })
    .setTimestamp();
  const sent = await channel.send({ embeds: [embed] });
  return { channelId, title, messageId: sent.id };
}

export async function publishPricesMessage(channelId: string, config: { title: string; description: string }) {
  if (!client || !gatewayOnline) throw new Error("El Gateway Discord no está conectado.");
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased() || !("send" in channel)) throw new Error("El canal Discord no permite mensajes.");
  const title = config.title.trim();
  const description = config.description.trim();
  if (!title || !description) throw new Error("El nombre y la descripción de Prices son obligatorios.");
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: `${title} · APP` })
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: `Copyright © ${new Date().getFullYear()} | ${title}` })
    .setTimestamp();
  const sent = await channel.send({ embeds: [embed] });
  return { channelId, title, messageId: sent.id };
}

export async function publishDiscordPanel(channelId: string, config?: { name?: string; description?: string; script?: string; hwidHours?: number }) {
  if (!client || !gatewayOnline) throw new Error("El Gateway Discord no está conectado.");
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased() || !("send" in channel)) throw new Error("El canal Discord no permite mensajes.");
  const base = panelMessage();
  const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(config?.name?.trim() || "Vanta.vs Protector · Access Panel").setDescription(config?.description?.trim() || "Este panel permite canjear tu key, obtener el script autorizado y conseguir tu rol.").setFooter({ text: config?.script ? `Script: ${config.script}` : "Vanta.vs Protector · Panel de acceso" }).setTimestamp();
  const sent = await channel.send({ embeds: [embed], components: base.components });
  return { channelId, title: config?.name?.trim() || "Vanta.vs Protector · Access Panel", messageId: sent.id };
}

export async function deletePublishedPanel(channelId: string, messageId: string) {
  if (!client || !gatewayOnline) throw new Error("El Gateway Discord no está conectado.");
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased() || !("messages" in channel)) throw new Error("El canal Discord no permite administrar mensajes.");
    const message = await channel.messages.fetch(messageId);
    await message.delete();
  } catch (error: any) {
    if (error?.code === 10008 || /unknown message/i.test(String(error?.message ?? ""))) return;
    throw error;
  }
}

export function startDiscordBot() {
  if (started || !ENV.discordBotToken) {
    if (!ENV.discordBotToken) console.warn("[Discord Bot] DISCORD_BOT_TOKEN no está configurado; el Gateway no se inicia.");
    return;
  }
  started = true;
  client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
  client.once(Events.ClientReady, async (readyClient) => {
    gatewayOnline = true;
    try {
      const rest = new REST({ version: "10" }).setToken(ENV.discordBotToken);
      await rest.put(Routes.applicationCommands(readyClient.application.id), { body: [] });
      await Promise.all(Array.from(readyClient.guilds.cache.keys()).map((guildId) => rest.put(Routes.applicationGuildCommands(readyClient.application.id, guildId), { body: discordCommands })));
      console.log(`[Discord Bot] Online como ${readyClient.user.tag}; comandos slash sincronizados por servidor sin duplicados.`);
      void warmScriptChoiceCache();
    } catch (error) {
      const detail = error && typeof error === "object" && "rawError" in error ? JSON.stringify((error as { rawError?: unknown }).rawError) : error instanceof Error ? error.message : String(error);
      console.error("[Discord Bot] No se pudieron sincronizar los comandos slash; el Gateway sigue online:", detail);
    }
  });
  client.on(Events.InteractionCreate, handleInteraction);
  client.on(Events.Error, (error) => { console.error("[Discord Bot] Gateway error:", error); handleGatewayFailure("Gateway error"); });
  client.on(Events.ShardDisconnect, () => { handleGatewayFailure("Gateway desconectado"); });
  client.login(ENV.discordBotToken).catch((error) => { started = false; gatewayOnline = false; console.error("[Discord Bot] No se pudo iniciar el Gateway:", error instanceof Error ? error.message : "error desconocido"); scheduleReconnect(); });
}

export async function targetChoices(interaction: any) {
  const focused = interaction.options.getFocused?.(true);
  const query = String(focused?.value ?? "").toLowerCase();
  if (focused?.name === "script") {
    const owner = await ownerAccount(interaction);
    if (!owner) return [];
    const cached = scriptChoiceCache.get(owner.id);
    let scripts = cached && cached.expiresAt > Date.now() ? cached.scripts : undefined;
    if (!scripts) {
      try {
        scripts = await Promise.race([
          getHostedScriptsByUser(owner.id),
          new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error("script autocomplete timeout")), SCRIPT_CHOICE_TIMEOUT_MS)),
        ]);
        scriptChoiceCache.set(owner.id, { expiresAt: Date.now() + SCRIPT_CHOICE_CACHE_MS, scripts });
      } catch (error) {
        console.warn("[Discord Bot] Script autocomplete unavailable:", error instanceof Error ? error.message : "unknown error");
        scripts = cached?.scripts ?? [];
      }
    }
    return scripts.filter((script: any) => !query || script.name.toLowerCase().includes(query)).slice(0, 25).map((script: any) => ({ name: script.name.slice(0, 100), value: script.name }));
  }
  const kind = interaction.options.getString("kind") ?? "user";
  return kind === "role"
    ? [...(interaction.guild?.roles?.cache?.values?.() ?? [])].filter((role: Role) => role.id !== interaction.guildId && (!query || role.name.toLowerCase().includes(query))).slice(0, 25).map((role: Role) => ({ name: `Role · ${role.name}`.slice(0, 100), value: `role:${role.id}` }))
    : [...(interaction.guild?.members?.cache?.values?.() ?? [])].filter((member: any) => !member.user?.bot && (!query || `${member.displayName} ${member.user?.username}`.toLowerCase().includes(query))).slice(0, 25).map((member: any) => ({ name: `User · ${member.displayName || member.user.username}`.slice(0, 100), value: `user:${member.user.id}` }));
}

export async function handleInteraction(interaction: any) {
  try {
    if (interaction.isAutocomplete?.()) return interaction.respond(await targetChoices(interaction));
    if (interaction.isModalSubmit()) return handleModal(interaction);
    if (interaction.isButton()) return handleButton(interaction);
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === "ping") return respond(interaction, { content: `Pong · ${Math.round(client?.ws.ping ?? 0)}ms`, ephemeral: true });
    if (interaction.commandName === "panel") {
      if (!(await isConfiguredOwner(interaction))) return respond(interaction, { content: "⛔ Solo el owner vinculado desde la web puede publicar el panel.", ephemeral: true });
      return respond(interaction, panelMessage());
    }
    if (interaction.commandName === "prices") return prices(interaction);
    if (interaction.commandName === "updates") return updates(interaction);
    if (interaction.commandName === "stats") return respond(interaction, { content: "Vanta.vs Protector está conectado. Usa el dashboard web para consultar scripts, licencias y actividad.", ephemeral: true });
    if (interaction.commandName === "apikey") return apiKeyForUser(interaction);
    if (interaction.commandName === "getscript") return getScriptForUser(interaction);
    if (interaction.commandName === "getkey") return getKeyForWhitelistedUser(interaction);
    if (interaction.commandName === "getrole") return configureBuyerRole(interaction, interaction.options.getRole("role", true));
    if (interaction.commandName === "redeem") return redeem(interaction, interaction.options.getString("key", true));
    if (interaction.commandName === "resethwid") return resetHwidCommand(interaction);
    if (interaction.commandName === "generatekeyrol") return configureKeyRole(interaction, interaction.options.getRole("role", true));
    if (interaction.commandName === "generatekey") return generate(interaction, interaction.options.getString("script", true), interaction.options.getString("duration"));
    if (interaction.commandName === "deletekey") return remove(interaction, interaction.options.getString("key", true));
    if (interaction.commandName === "addtime") return addTime(interaction, interaction.options.getString("key", true), interaction.options.getString("duration", true));
    if (interaction.commandName === "warn") return warn(interaction, interaction.options.getUser("user", true), interaction.options.getString("reason", true));
    if (interaction.commandName === "dropkey") return dropKeys(interaction, interaction.options.getInteger("amount", true));
    if (interaction.commandName === "blacklist") return blacklistCommand(interaction);
    if (interaction.commandName === "whitelabel") return whitelistCommand(interaction);
    if (interaction.commandName === "unwhitelist") return unwhitelistCommand(interaction);
  } catch (error) {
    console.error("[Discord Bot] Interaction handler failed:", error);
    const currentInteraction = interaction as any;
    if (!currentInteraction.replied && !currentInteraction.deferred) await respond(currentInteraction, { content: "No se pudo completar la acción. Revisa la configuración del panel.", ephemeral: true });
  }
}

async function apiKeyForUser(interaction: any) {
  let result = await getApiKeyByDiscordUserId(interaction.user.id);
  const owner = await ownerAccount(interaction);
  if (!result && owner && (interaction.guild?.ownerId === interaction.user.id || owner.discordUserId === interaction.user.id)) {
    if (owner) {
      const displayName = interaction.user.globalName || interaction.user.username || "Discord owner";
      await linkDiscordIdentity(owner.id, interaction.user.id, displayName, interaction.user.globalName || null, interaction.user.displayAvatarURL?.({ extension: "png", size: 128 }) ?? null);
      await ensureUserApiKey(owner.id);
      result = await getApiKeyByDiscordUserId(interaction.user.id);
    }
  }
  if (!result?.apiKey) return respond(interaction, { content: "❌ No hay una cuenta web vinculada a este usuario de Discord. Vincula Discord desde Vanta.vs Protector e inténtalo otra vez.", ephemeral: true });
  const copyRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`vanta:copy-api-key:${result.apiKey}`).setLabel("Copiar API key").setStyle(ButtonStyle.Secondary),
  );
  return respond(interaction, { content: `🔐 **Tu API key de Vanta.vs Protector**\n\`${result.apiKey}\`\n\nEsta key identifica tu cuenta vinculada.`, components: [copyRow], ephemeral: true });
}

async function getUserLicenses(discordUserId: string) {
  const user = await getUserByDiscordUserId(discordUserId);
  const licenses = (await getActiveLicensesByDiscordUserId(discordUserId)).filter((license: any) => !license.expiresAt || license.expiresAt.getTime() > Date.now());
  const ownerIds = Array.from(new Set(licenses.map((license: any) => Number(license.ownerId)).filter((id) => Number.isInteger(id) && id > 0)));
  const scriptRows = await Promise.all(ownerIds.map((ownerId) => getHostedScriptsByUser(ownerId)));
  const scripts = scriptRows.flat();
  return { user, licenses, scripts };
}

async function getWhitelistScriptForMember(interaction: any) {
  const owner = await ownerAccount(interaction);
  if (!owner) return undefined;
  let member = interaction.member;
  if (interaction.guild?.members?.fetch) {
    try { member = await interaction.guild.members.fetch(interaction.user.id); } catch (error) { console.warn("[Discord Bot] Could not fetch member roles for whitelist", error); }
  }
  const roleIds = Array.isArray(member?.roles) ? member.roles : Array.from(member?.roles?.cache?.keys?.() ?? []);
  const rules = (await getAccessRulesByOwner(owner.id)).filter((rule: any) => matchesWhitelistRule(rule, interaction.user.id, roleIds));
  for (const rule of rules) {
    const script = await getHostedScriptById(Number(rule.hostedScriptId));
    if (script) return { owner, script };
  }
  return undefined;
}

async function getKeyForWhitelistedUser(interaction: any) {
  const match = await getWhitelistScriptForMember(interaction);
  if (!match) return respond(interaction, { content: "❌ No tienes un usuario o rol whitelisted para ningún script. Pide al owner que te añada y vuelve a pulsar Get Key.", ephemeral: true });
  const existing = (await getActiveLicensesByDiscordUserId(interaction.user.id)).find((license: any) => Number(license.ownerId) === match.owner.id && Number(license.hostedScriptId) === match.script.id && (!license.expiresAt || license.expiresAt.getTime() > Date.now()));
  const license = existing ?? await createLicense({ ownerId: match.owner.id, hostedScriptId: match.script.id, keyCode: keyCode(), type: "license", status: "active", discordUserId: interaction.user.id, hwid: null, expiresAt: null });
  if (!license) return respond(interaction, { content: "❌ No se pudo crear tu key automática. Inténtalo de nuevo.", ephemeral: true });
  return respond(interaction, { content: `✅ **Whitelist verificada** para **${match.script.name}**.\n\nTu key automática:\n\`${license.keyCode}\`\n\nEsta key queda vinculada a tu cuenta de Discord y al script autorizado.`, ephemeral: true });
}

async function getScriptForUser(interaction: any) {
  const access = await getUserLicenses(interaction.user.id);
  const license = access.licenses[0];
  if (!license) return respond(interaction, { content: "❌ No tienes una key activa. Pulsa Redeem Key y canjea una key válida antes de solicitar el script.", ephemeral: true });
  const script = license.hostedScriptId ? await getHostedScriptById(license.hostedScriptId) : access.scripts[0];
  if (!script) return respond(interaction, { content: "❌ Tu key está activa, pero todavía no hay un script asignado.", ephemeral: true });
  const loader = scriptRuntimeLoader(script, license.keyCode, license.id);
  const copyRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("vanta:copy-loader").setLabel(GET_SCRIPT_COPY_BUTTON_LABEL).setStyle(ButtonStyle.Secondary),
  );
  return respond(interaction, { content: `📜 **${script.name}**\n\n\`\`\`lua\n${loader}\n\`\`\``, components: [copyRow], ephemeral: true });
}

async function copyScriptForUser(interaction: any) {
  const access = await getUserLicenses(interaction.user.id);
  const license = access.licenses[0];
  if (!license) return respond(interaction, { content: "❌ No tienes una key activa.", ephemeral: true });
  const script = license.hostedScriptId ? await getHostedScriptById(license.hostedScriptId) : access.scripts[0];
  if (!script) return respond(interaction, { content: "❌ Tu key no tiene un script asignado.", ephemeral: true });
  return respond(interaction, { content: mobileViewScriptMessage(script, license.keyCode, license.id), ephemeral: true });
}

async function configureBuyerRole(interaction: any, role: { id: string }) {
  const owner = await ownerAccount(interaction);
  if (!owner || !(await isConfiguredOwner(interaction))) return respond(interaction, { content: "⛔ Solo el owner vinculado puede configurar el rol comprador.", ephemeral: true });
  await setBuyerRoleId(owner.id, role.id);
  return respond(interaction, { content: `✅ Rol comprador configurado: <@&${role.id}>. Los usuarios con una key activa podrán obtenerlo desde Get Role.`, ephemeral: true });
}

async function getRoleForUser(interaction: any) {
  const access = await getUserLicenses(interaction.user.id);
  if (!access.licenses[0]) return respond(interaction, { content: "👤 No tienes una key activa. Canjea una key válida primero.", ephemeral: true });
  const owner = access.user ? await getUserByOpenId(ENV.ownerOpenId) : await ownerAccount();
  const roleId = owner ? await getBuyerRoleId(owner.id) : undefined;
  if (!roleId) return respond(interaction, { content: "👤 Tu key está activa, pero el owner todavía no ha configurado el rol comprador con /getrole.", ephemeral: true });
  if (!interaction.guild?.members?.fetch) return respond(interaction, { content: "❌ Este botón solo puede usarse dentro del servidor de Discord.", ephemeral: true });
  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    await member.roles.add(roleId);
    return respond(interaction, { content: `✅ Rol comprador asignado: <@&${roleId}>`, ephemeral: true });
  } catch (error) {
    console.error("[Discord Bot] Buyer role assignment failed:", error);
    return respond(interaction, { content: "❌ No pude asignar el rol. Verifica que el bot tenga Manage Roles y que su rol esté por encima del rol comprador.", ephemeral: true });
  }
}

async function handleButton(interaction: ButtonInteraction) {
  if (interaction.customId === "vanta:redeem") {
    const modal = new ModalBuilder().setCustomId("vanta:redeem-modal").setTitle("Redeem Key");
    const input = new TextInputBuilder().setCustomId("key").setLabel("Key alfanumérica").setStyle(TextInputStyle.Short).setMinLength(32).setMaxLength(64).setRequired(true);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    return interaction.showModal(modal);
  }
  if (interaction.customId === "vanta:get-key") return getKeyForWhitelistedUser(interaction);
  if (interaction.customId === "vanta:script") return getScriptForUser(interaction);
  if (interaction.customId === "vanta:copy-loader") {
    const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("vanta:copy-loader").setLabel(GET_SCRIPT_COPY_BUTTON_LABEL).setStyle(ButtonStyle.Secondary),
    );
    if (interaction.message?.edit) await interaction.message.edit({ components: [updatedRow] }).catch(() => undefined);
    return copyScriptForUser(interaction);
  }
  if (interaction.customId.startsWith("vanta:copy-key:")) {
    const key = interaction.customId.slice("vanta:copy-key:".length).trim();
    if (!/^[A-Za-z0-9-]{1,64}$/.test(key)) return respond(interaction, { content: "❌ Esta key ya no es válida.", ephemeral: true });
    return respond(interaction, { content: `\`${key}\``, ephemeral: true });
  }
  if (interaction.customId.startsWith("vanta:copy-api-key:")) {
    const key = interaction.customId.slice("vanta:copy-api-key:".length).trim();
    if (!/^VANTA-[A-Za-z0-9_-]{20,64}$/.test(key)) return respond(interaction, { content: "❌ Esta API key ya no es válida.", ephemeral: true });
    return respond(interaction, { content: `\`${key}\``, ephemeral: true });
  }
  if (interaction.customId === "vanta:role") return getRoleForUser(interaction);
  if (interaction.customId === "vanta:hwid") {
    const reset = await resetLicenseHwidByDiscordUserId(interaction.user.id);
    if (reset.reason === "not_found") return respond(interaction, { content: "❌ No tienes una key activa vinculada a tu Discord.", ephemeral: true });
    if (reset.reason === "cooldown") return respond(interaction, { content: `⏳ El HWID ya fue reiniciado. Podrás volver a hacerlo <t:${Math.floor(reset.retryAt.getTime() / 1000)}:R>.`, ephemeral: true });
    return respond(interaction, { content: "✅ HWID reiniciado correctamente. El próximo reset estará disponible en 24 horas.", ephemeral: true });
  }
  if (interaction.customId === "vanta:stats") {
    const access = await getUserLicenses(interaction.user.id);
    const license = access.licenses[0];
    if (!license) return respond(interaction, { content: "📊 No tienes una key activa. Usa Redeem Key para comenzar.", ephemeral: true });
    const expires = license.expiresAt ? `<t:${Math.floor(license.expiresAt.getTime() / 1000)}:R>` : "never";
    return respond(interaction, { content: `📊 **Access Stats**\nKey: \`${license.keyCode}\`\nExpires: ${expires}\nHWID bound: ${license.hwid ? "yes" : "no (unbound)"}\nNext user reset: gestionado por el cooldown del panel.`, ephemeral: true });
  }
}
async function handleModal(interaction: any) {
  if (interaction.customId === "vanta:redeem-modal") return redeem(interaction, interaction.fields.getTextInputValue("key"));
}
async function redeem(interaction: any, rawKey: string) {
  const license = await redeemLicense(rawKey.trim(), interaction.user.id);
  return respond(interaction, license ? { content: `✅ Key canjeada correctamente: **${license.keyCode}**.`, ephemeral: true } : { content: "❌ Key inválida, expirada o ya vinculada a otra cuenta.", ephemeral: true });
}
async function configureKeyRole(interaction: any, role: { id: string }) {
  const owner = await ownerAccount(interaction);
  if (!owner || !(await isConfiguredOwner(interaction))) return respond(interaction, { content: "⛔ Solo el owner vinculado desde la web puede configurar Generate Key Role.", ephemeral: true });
  await setKeyManagerRole(owner.id, role.id);
  return respond(interaction, { content: `✅ El rol <@&${role.id}> ahora puede usar "/generatekey" y "/deletekey".`, ephemeral: true });
}
async function whitelist(interaction: any, discordId: string, kind: "user" | "role", scriptName: string) {
  const owner = await ownerAccount(interaction);
  if (!owner || !(await isConfiguredOwner(interaction))) return respond(interaction, { content: "⛔ Solo el owner vinculado puede modificar la whitelist.", ephemeral: true });
  const script = await getHostedScriptByName(owner.id, scriptName);
  if (!script) return respond(interaction, { content: "❌ Selecciona un script hosteado válido de tu workspace.", ephemeral: true });
  const counts = await createAccessRuleIfAbsent({ ownerId: owner.id, hostedScriptId: script.id, kind, discordId: discordId.trim(), label: kind === "role" ? "Buyer role" : "Buyer user" });
  const rules = await getAccessRulesByOwner(owner.id);
  const channel = interaction.channelId ? `<#${interaction.channelId}>` : "canal actual";
  const embed = new EmbedBuilder().setColor(0x57f287).setTitle("✅ Whitelisted").setDescription(`Acceso concedido a **${kind === "role" ? `<@&${discordId}>` : `<@${discordId}>`}** en **${script.name}**.\n\n**Added:** ${counts.added} · **Already whitelisted:** ${counts.alreadyWhitelisted} · **Failed:** ${counts.failed}\n\nAccess the script via → ${channel}`).setFooter({ text: `Reglas activas: ${rules.length}` });
  return respond(interaction, { embeds: [embed] });
}
async function unwhitelist(interaction: any, discordId: string, scriptName: string) {
  const owner = await ownerAccount(interaction);
  if (!owner || !(await isConfiguredOwner(interaction))) return respond(interaction, { content: "⛔ Solo el owner vinculado puede modificar la whitelist.", ephemeral: true });
  const script = await getHostedScriptByName(owner.id, scriptName);
  if (!script) return respond(interaction, { content: "❌ Selecciona un script hosteado válido de tu workspace.", ephemeral: true });
  const removed = await deleteAccessRuleByDiscordId(owner.id, discordId.trim(), script.id);
  return respond(interaction, { content: removed ? `✅ Whitelist retirada para **${discordId.trim()}** en **${script.name}**.` : "No se encontró una regla activa para ese script y destino.", ephemeral: true });
}
export function parseDuration(raw: string) {
  const match = raw.trim().match(/^(\d+)\s*(m|min|h|d|day|days|w|week|weeks|mo|month|months|y|year|years)$/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === "m" || unit === "min") return value * 60_000;
  if (unit === "h") return value * 3_600_000;
  if (["d", "day", "days"].includes(unit)) return durationToMs(value, "days");
  if (["w", "week", "weeks"].includes(unit)) return durationToMs(value * 7, "days");
  if (["mo", "month", "months"].includes(unit)) return durationToMs(value, "months");
  if (["y", "year", "years"].includes(unit)) return durationToMs(value, "years");
  return undefined;
}

async function prices(interaction: any) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: "Vanta.vs Protector · APP" })
    .setTitle("Vanta.vs Protector · Plans")
    .setDescription(`${buildPlansDescription()}\n\nFFA / Trial global: acceso para todos sin key individual.\nModo protegido: requiere una key activa.`)
    .setFooter({ text: `Copyright © ${new Date().getFullYear()} | Vanta.vs Protector` })
    .setTimestamp();
  return respond(interaction, { embeds: [embed] });
}

async function updates(interaction: any) {
  const embed = new EmbedBuilder()
    .setColor(0xe93540)
    .setAuthor({ name: "Vanta.vs Protector · APP" })
    .setTitle("Project Updates")
    .setDescription("Consulta el dashboard para ver las novedades, cambios de protección y avisos importantes del proyecto.")
    .setFooter({ text: `Actualización · ${new Date().getFullYear()} | Vanta.vs Protector` })
    .setTimestamp();
  return respond(interaction, { embeds: [embed] });
}

async function resetHwidCommand(interaction: any) {
  const target = interaction.options.getUser("user", true);
  const result = await canManageKeys(interaction);
  if (!result.allowed) return respond(interaction, { content: "⛔ Solo el propietario, un administrador o el rol delegado puede reiniciar HWID.", ephemeral: true });
  const reset = await resetLicenseHwidByDiscordUserId(target.id);
  if (reset.reason === "not_found") return respond(interaction, { content: "❌ No se encontraron keys activas para ese usuario.", ephemeral: true });
  if (reset.reason === "cooldown") return respond(interaction, { content: `⏳ Ese usuario ya reinició su HWID. Podrá volver a hacerlo <t:${Math.floor(reset.retryAt.getTime() / 1000)}:R>.`, ephemeral: true });
  return respond(interaction, { content: `✅ HWID reiniciado para <@${target.id}> en el script indicado. El próximo reset estará disponible en 24 horas.`, ephemeral: true });
}

async function addTime(interaction: any, key: string, rawDuration: string) {
  const result = await canManageKeys(interaction);
  if (!result.allowed || !result.owner) return respond(interaction, { content: "⛔ No tienes permiso para añadir tiempo.", ephemeral: true });
  const durationMs = parseDuration(rawDuration);
  if (!durationMs) return respond(interaction, { content: "❌ Usa una duración como `30d`, `12h`, `4weeks`, `3months` o `1year`.", ephemeral: true });
  const license = await addTimeToLicense(result.owner.id, key.trim(), durationMs);
  if (!license) return respond(interaction, { content: "❌ No se encontró esa key.", ephemeral: true });
  return respond(interaction, { content: `✅ Se añadieron **${rawDuration}** a **${key.trim()}**.\nScript objetivo: ${license.hostedScriptId ? `#${license.hostedScriptId}` : "todos los accesos de la key"}.`, ephemeral: true });
}

async function warn(interaction: any, user: { id: string }, reason: string) {
  const owner = await ownerAccount(interaction);
  if (!owner || (!(await isConfiguredOwner(interaction)) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))) return respond(interaction, { content: "⛔ Solo el propietario o un administrador puede advertir usuarios.", ephemeral: true });
  await createWarning({ ownerId: owner.id, discordUserId: user.id, reason: reason.trim(), hostedScriptId: null });
  return respond(interaction, { content: `⚠️ <@${user.id}> recibió una advertencia.\nRazón: ${reason.trim()}` });
}

async function dropKeys(interaction: any, amount: number) {
  const result = await canManageKeys(interaction);
  if (!result.allowed || !result.owner) return respond(interaction, { content: "⛔ No tienes permiso para hacer un drop.", ephemeral: true });
  const keys: string[] = [];
  for (let i = 0; i < amount; i++) { const row = await createLicense({ ownerId: result.owner.id, keyCode: keyCode(), type: "license", status: "active", discordUserId: null, hwid: null, expiresAt: null, hostedScriptId: null }); if (row) { keys.push(row.keyCode); await createKeyAuditLog({ ownerId: result.owner.id, actorDiscordId: interaction.user.id, action: "generate", keyCode: row.keyCode }); } }
  await interaction.reply({ content: "# Key drop!!\\n@everyone" });
  for (let index = amount; index > 0; index--) await interaction.followUp({ content: `${index}` });
  await interaction.followUp({ content: "# GO!!" });
  for (const generatedKey of keys) await interaction.followUp({ content: generatedKey });
  return undefined;
}
async function blacklistCommand(interaction: any) {
  const owner = await ownerAccount(interaction);
  const user = interaction.options.getUser("user", true);
  const script = interaction.options.getString("script", true);
  const reason = interaction.options.getString("reason") ?? "Sin razón indicada";
  if (!owner || (!(await isConfiguredOwner(interaction)) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))) return respond(interaction, { content: "⛔ Solo el propietario o un administrador puede usar blacklist.", ephemeral: true });
  await createBlacklist({ ownerId: owner.id, discordUserId: user.id, reason, active: 1 });
  return respond(interaction, { content: `✅ Blacklist aplicada para <@${user.id}> en **${script}**.\nRazón: ${reason}` });
}

function selectedTarget(interaction: any) {
  const raw = interaction.options.getString("target");
  if (raw?.includes(":")) { const [kind, id] = raw.split(":", 2); if ((kind === "user" || kind === "role") && id) return { kind, id }; }
  const targetUser = interaction.options.getUser?.("user");
  const targetRole = interaction.options.getRole?.("role");
  if (targetUser) return { kind: "user", id: targetUser.id };
  if (targetRole) return { kind: "role", id: targetRole.id };
  return undefined;
}
async function whitelistCommand(interaction: any) {
  const target = selectedTarget(interaction);
  const selectedKind = interaction.options.getString("kind");
  const scriptName = interaction.options.getString("script", true);
  if (!target) return respond(interaction, { content: "❌ Selecciona un usuario o rol en el desplegable de target.", ephemeral: true });
  if (selectedKind && target.kind !== selectedKind) return respond(interaction, { content: "❌ El target no coincide con el tipo seleccionado. Vuelve a elegirlo en el desplegable.", ephemeral: true });
  return whitelist(interaction, target.id, target.kind, scriptName);
}
async function unwhitelistCommand(interaction: any) {
  const target = selectedTarget(interaction);
  const selectedKind = interaction.options.getString("kind");
  const scriptName = interaction.options.getString("script", true);
  if (!target) return respond(interaction, { content: "❌ Selecciona un usuario o rol en el desplegable de target.", ephemeral: true });
  if (selectedKind && target.kind !== selectedKind) return respond(interaction, { content: "❌ El target no coincide con el tipo seleccionado. Vuelve a elegirlo en el desplegable.", ephemeral: true });
  return unwhitelist(interaction, target.id, scriptName);
}

async function generate(interaction: any, scriptName: string, rawDuration?: string | null) {
  const result = await canManageKeys(interaction);
  if (!canPerformKeyAction(interaction.user.id)) return respond(interaction, { content: "⏳ Espera unos segundos antes de gestionar otra key.", ephemeral: true });
  if (!result.allowed || !result.owner) return respond(interaction, { content: "⛔ No tienes permiso para generar keys.", ephemeral: true });
  const script = await getHostedScriptByName(result.owner.id, scriptName);
  if (!script) return respond(interaction, { content: `❌ No se encontró el script **${scriptName}** en tu workspace.`, ephemeral: true });
  const durationMs = rawDuration ? parseDuration(rawDuration) : undefined;
  if (rawDuration && !durationMs) return respond(interaction, { content: "❌ Usa `30d`, `12h`, `4weeks`, `3months` o `1year`, o déjala vacía para forever.", ephemeral: true });
  const row = await createLicense({ ownerId: result.owner.id, keyCode: keyCode(), type: "license", status: "active", discordUserId: null, hwid: null, expiresAt: durationMs ? new Date(Date.now() + durationMs) : null, hostedScriptId: script.id });
  if (row) await createKeyAuditLog({ ownerId: result.owner.id, actorDiscordId: interaction.user.id, action: "generate", keyCode: row.keyCode });
  if (!row) return respond(interaction, { content: "No se pudo generar la key.", ephemeral: true });
  const copyRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`vanta:copy-key:${row.keyCode}`).setLabel("Copiar key").setStyle(ButtonStyle.Secondary),
  );
  return respond(interaction, { content: `✅ Key generada para **${script.name}**:\n\`${row.keyCode}\``, components: [copyRow], ephemeral: true });
}
async function remove(interaction: any, value: string) {
  const result = await canManageKeys(interaction);
  if (!result.allowed || !result.owner) return respond(interaction, { content: "⛔ No tienes permiso para eliminar keys.", ephemeral: true });
  if (!canPerformKeyAction(interaction.user.id)) return respond(interaction, { content: "⏳ Espera unos segundos antes de gestionar otra key.", ephemeral: true });
  const removed = await deleteLicenseByKeyCode(result.owner.id, value.trim());
  if (removed) await createKeyAuditLog({ ownerId: result.owner.id, actorDiscordId: interaction.user.id, action: "delete", keyCode: value.trim() });
  return respond(interaction, { content: removed ? `🗑️ Key **${value.trim()}** eliminada.` : "No se encontró esa key en tu workspace.", ephemeral: true });
}
function canPerformKeyAction(actorId: string) {
  const now = Date.now();
  const last = keyActionTimestamps.get(actorId) ?? 0;
  if (now - last < KEY_ACTION_COOLDOWN_MS) return false;
  keyActionTimestamps.set(actorId, now);
  return true;
}
