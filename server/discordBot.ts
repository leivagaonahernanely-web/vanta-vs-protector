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
  getUserByDiscordUserId,
  getUserByOpenId,
  redeemLicense,
  resetLicenseHwidByDiscordUserId,
  setKeyManagerRole,
} from "./db";
import { randomInt } from "node:crypto";

const PANEL_URL = "https://vanta-prot-hfw5hmym.manus.space";
export const discordCommands = [
  new SlashCommandBuilder().setName("ping").setDescription("Verifica la latencia del bot").toJSON(),
  new SlashCommandBuilder().setName("panel").setDescription("Publica el panel de Vanta.vs Protector").toJSON(),
  new SlashCommandBuilder().setName("stats").setDescription("Muestra el estado del acceso").toJSON(),
  new SlashCommandBuilder().setName("getscript").setDescription("Obtiene el enlace de acceso al script").toJSON(),
  new SlashCommandBuilder().setName("getrole").setDescription("Solicita el rol comprador").toJSON(),
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
  new SlashCommandBuilder().setName("generatekeyrol").setDescription("Configura el rol autorizado para gestionar keys").addRoleOption(o => o.setName("role").setDescription("Rol delegado").setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString()).toJSON(),
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

const KEY_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function keyCode() { let key = ""; for (let index = 0; index < 32; index += 1) key += KEY_ALPHABET[randomInt(0, KEY_ALPHABET.length)]; return key; }
function memberHasRole(interaction: ButtonInteraction | any, roleId: string | undefined) {
  if (!roleId) return false;
  const roles = interaction.member?.roles;
  return Array.isArray(roles) ? roles.includes(roleId) : Boolean(roles?.cache?.has(roleId));
}
export function hasKeyManagementAccess(input: { actorId: string; ownerId?: string | null; isAdministrator: boolean; hasManagerRole: boolean }) {
  return Boolean(input.ownerId && (input.actorId === input.ownerId || input.isAdministrator || input.hasManagerRole));
}
export function isGuildOwner(input: { actorId: string; guildOwnerId?: string | null }) {
  return Boolean(input.guildOwnerId && input.actorId === input.guildOwnerId);
}
async function ownerAccount() { return ENV.ownerOpenId ? getUserByOpenId(ENV.ownerOpenId) : undefined; }
async function isConfiguredOwner(interaction: any) {
  const owner = await ownerAccount();
  return Boolean(owner?.discordUserId && interaction.user?.id === owner.discordUserId);
}
async function canManageKeys(interaction: any) {
  const owner = await ownerAccount();
  if (!owner) return { allowed: false, owner: undefined };
  const managerRole = await getKeyManagerRoleId(owner.id);
  const actorIsGuildOwner = isGuildOwner({ actorId: interaction.user.id, guildOwnerId: interaction.guild?.ownerId });
  return { allowed: actorIsGuildOwner || hasKeyManagementAccess({ actorId: interaction.user.id, ownerId: owner.discordUserId, isAdministrator: Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)), hasManagerRole: memberHasRole(interaction, managerRole) }), owner };
}
export async function respond(interaction: any, payload: any) {
  const target = interaction as object;
  if (respondedInteractions.has(target)) return undefined;
  respondedInteractions.add(target);
  if (interaction.replied || interaction.deferred) return interaction.followUp(payload);
  return interaction.reply(payload);
}
export function scriptRuntimeLoader(script: any, accessKey?: string) {
  const url = `${PANEL_URL}/scripts/hosted/${script.slug}`;
  const runtimeKey = script.ffaMode ? "trial" : (accessKey || script.scriptKey);
  const accessUrl = runtimeKey ? `${url}?key=${encodeURIComponent(runtimeKey)}` : url;
  const load = `loadstring(game:HttpGet("${accessUrl}"))()`;
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
    const owner = await ownerAccount();
    const scripts = owner ? await getHostedScriptsByUser(owner.id) : [];
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
    if (interaction.commandName === "getscript") return getScriptForUser(interaction);
    if (interaction.commandName === "getrole") return getRoleForUser(interaction);
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

async function getUserLicenses(discordUserId: string) {
  const user = await getUserByDiscordUserId(discordUserId);
  const licenses = (await getActiveLicensesByDiscordUserId(discordUserId)).filter((license: any) => !license.expiresAt || license.expiresAt.getTime() > Date.now());
  const ownerIds = Array.from(new Set(licenses.map((license: any) => Number(license.ownerId)).filter((id) => Number.isInteger(id) && id > 0)));
  const scriptRows = await Promise.all(ownerIds.map((ownerId) => getHostedScriptsByUser(ownerId)));
  const scripts = scriptRows.flat();
  return { user, licenses, scripts };
}

async function getScriptForUser(interaction: any) {
  const access = await getUserLicenses(interaction.user.id);
  const license = access.licenses[0];
  if (!license) return respond(interaction, { content: "❌ No tienes una key activa. Pulsa Redeem Key y canjea una key válida antes de solicitar el script.", ephemeral: true });
  const script = license.hostedScriptId ? await getHostedScriptById(license.hostedScriptId) : access.scripts[0];
  if (!script) return respond(interaction, { content: "❌ Tu key está activa, pero todavía no hay un script asignado.", ephemeral: true });
  const loader = scriptRuntimeLoader(script, license.keyCode);
  const copyRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`vanta:copy-key:${license.keyCode}`).setLabel("Copiar key").setStyle(ButtonStyle.Secondary),
  );
  return respond(interaction, { content: `📜 **${script.name}**\n\n🔑 **Key activa:** \`${license.keyCode}\`\n\n📦 **Loadstring con la key:**\n\`\`\`lua\n${loader}\n\`\`\``, components: [copyRow], ephemeral: true });
}

async function getRoleForUser(interaction: any) {
  const access = await getUserLicenses(interaction.user.id);
  if (!access.licenses[0]) return respond(interaction, { content: "👤 No tienes una key activa. Canjea una key válida primero.", ephemeral: true });
  return respond(interaction, { content: "👤 Key validada. El rol comprador se asignará cuando el propietario configure el rol de comprador.", ephemeral: true });
}

async function handleButton(interaction: ButtonInteraction) {
  if (interaction.customId === "vanta:redeem") {
    const modal = new ModalBuilder().setCustomId("vanta:redeem-modal").setTitle("Redeem Key");
    const input = new TextInputBuilder().setCustomId("key").setLabel("Key alfanumérica").setStyle(TextInputStyle.Short).setMinLength(32).setMaxLength(64).setRequired(true);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    return interaction.showModal(modal);
  }
  if (interaction.customId === "vanta:script") return getScriptForUser(interaction);
  if (interaction.customId.startsWith("vanta:copy-key:")) {
    const key = interaction.customId.slice("vanta:copy-key:".length).trim();
    if (!/^[A-Za-z0-9-]{1,64}$/.test(key)) return respond(interaction, { content: "❌ Esta key ya no es válida.", ephemeral: true });
    return respond(interaction, { content: `\`${key}\``, ephemeral: true });
  }
  if (interaction.customId === "vanta:role") return getRoleForUser(interaction);
  if (interaction.customId === "vanta:hwid") { await resetLicenseHwidByDiscordUserId(interaction.user.id); return respond(interaction, { content: "✅ HWID reiniciado correctamente.", ephemeral: true }); }
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
  const owner = await ownerAccount();
  if (!owner || !(await isConfiguredOwner(interaction))) return respond(interaction, { content: "⛔ Solo el owner vinculado desde la web puede configurar Generate Key Role.", ephemeral: true });
  await setKeyManagerRole(owner.id, role.id);
  return respond(interaction, { content: `✅ El rol <@&${role.id}> ahora puede usar "/generatekey" y "/deletekey".`, ephemeral: true });
}
async function whitelist(interaction: any, discordId: string, kind: "user" | "role", scriptName: string) {
  const owner = await ownerAccount();
  if (!owner || interaction.user.id !== owner.discordUserId) return respond(interaction, { content: "⛔ Solo el owner vinculado puede modificar la whitelist.", ephemeral: true });
  const script = await getHostedScriptByName(owner.id, scriptName);
  if (!script) return respond(interaction, { content: "❌ Selecciona un script hosteado válido de tu workspace.", ephemeral: true });
  const counts = await createAccessRuleIfAbsent({ ownerId: owner.id, hostedScriptId: script.id, kind, discordId: discordId.trim(), label: kind === "role" ? "Buyer role" : "Buyer user" });
  const rules = await getAccessRulesByOwner(owner.id);
  const channel = interaction.channelId ? `<#${interaction.channelId}>` : "canal actual";
  const embed = new EmbedBuilder().setColor(0x57f287).setTitle("✅ Whitelisted").setDescription(`Acceso concedido a **${kind === "role" ? `<@&${discordId}>` : `<@${discordId}>`}** en **${script.name}**.\n\n**Added:** ${counts.added} · **Already whitelisted:** ${counts.alreadyWhitelisted} · **Failed:** ${counts.failed}\n\nAccess the script via → ${channel}`).setFooter({ text: `Reglas activas: ${rules.length}` });
  return respond(interaction, { embeds: [embed] });
}
async function unwhitelist(interaction: any, discordId: string, scriptName: string) {
  const owner = await ownerAccount();
  if (!owner || interaction.user.id !== owner.discordUserId) return respond(interaction, { content: "⛔ Solo el owner vinculado puede modificar la whitelist.", ephemeral: true });
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
  await resetLicenseHwidByDiscordUserId(target.id);
  return respond(interaction, { content: `✅ HWID reiniciado para <@${target.id}> en el script indicado.`, ephemeral: true });
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
  const owner = await ownerAccount();
  if (!owner || (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) && interaction.user.id !== owner.discordUserId)) return respond(interaction, { content: "⛔ Solo el propietario o un administrador puede advertir usuarios.", ephemeral: true });
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
  const owner = await ownerAccount();
  const user = interaction.options.getUser("user", true);
  const script = interaction.options.getString("script", true);
  const reason = interaction.options.getString("reason") ?? "Sin razón indicada";
  if (!owner || (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) && interaction.user.id !== owner.discordUserId)) return respond(interaction, { content: "⛔ Solo el propietario o un administrador puede usar blacklist.", ephemeral: true });
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
