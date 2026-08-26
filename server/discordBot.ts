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
import { ENV } from "./_core/env";
import {
  createAccessRuleIfAbsent,
  createKeyAuditLog,
  deleteAccessRuleByDiscordId,
  getAccessRulesByOwner,
  createLicense,
  deleteLicenseByKeyCode,
  getKeyManagerRoleId,
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
  new SlashCommandBuilder().setName("stats").setDescription("Muestra el estado del servicio").toJSON(),
  new SlashCommandBuilder().setName("getscript").setDescription("Abre el acceso web al script autorizado").toJSON(),
  new SlashCommandBuilder().setName("getrole").setDescription("Solicita el rol comprador después de validar una key").toJSON(),
  new SlashCommandBuilder().setName("redeem").setDescription("Canjea una key de 10 dígitos").addStringOption(o => o.setName("key").setDescription("Key de licencia").setRequired(true)).toJSON(),
  new SlashCommandBuilder().setName("generatekey").setDescription("Genera una key para el script").toJSON(),
  new SlashCommandBuilder().setName("deletekey").setDescription("Elimina una key").addStringOption(o => o.setName("key").setDescription("Key a eliminar").setRequired(true)).toJSON(),
  new SlashCommandBuilder().setName("resethwid").setDescription("Reinicia tu HWID").toJSON(),
  new SlashCommandBuilder().setName("generatekeyrol").setDescription("Configura el rol autorizado para gestionar keys").addRoleOption(o => o.setName("role").setDescription("Rol delegado").setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString()).toJSON(),
  new SlashCommandBuilder().setName("whitelist").setDescription("Añade un usuario o rol a la whitelist").addStringOption(o => o.setName("id").setDescription("Discord User ID o Role ID").setRequired(true)).addStringOption(o => o.setName("tipo").setDescription("user o role").setRequired(true).addChoices({ name: "Usuario", value: "user" }, { name: "Rol", value: "role" })).toJSON(),
  new SlashCommandBuilder().setName("unwhitelist").setDescription("Retira un usuario o rol de la whitelist").addStringOption(o => o.setName("id").setDescription("Discord User ID o Role ID").setRequired(true)).toJSON(),
];

let started = false;
let client: Client | null = null;
const keyActionTimestamps = new Map<string, number>();
const KEY_ACTION_COOLDOWN_MS = 10_000;

function keyCode() { return String(randomInt(1_000_000_000, 10_000_000_000)); }
function memberHasRole(interaction: ButtonInteraction | any, roleId: string | undefined) {
  if (!roleId) return false;
  const roles = interaction.member?.roles;
  return Array.isArray(roles) ? roles.includes(roleId) : Boolean(roles?.cache?.has(roleId));
}
export function hasKeyManagementAccess(input: { actorId: string; ownerId?: string | null; isAdministrator: boolean; hasManagerRole: boolean }) {
  return Boolean(input.ownerId && (input.actorId === input.ownerId || input.isAdministrator || input.hasManagerRole));
}
async function ownerAccount() { return ENV.ownerOpenId ? getUserByOpenId(ENV.ownerOpenId) : undefined; }
async function canManageKeys(interaction: any) {
  const owner = await ownerAccount();
  if (!owner) return { allowed: false, owner: undefined };
  const managerRole = await getKeyManagerRoleId(owner.id);
  return { allowed: hasKeyManagementAccess({ actorId: interaction.user.id, ownerId: owner.discordUserId, isAdministrator: Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)), hasManagerRole: memberHasRole(interaction, managerRole) }), owner };
}
async function respond(interaction: any, payload: any) {
  if (interaction.replied || interaction.deferred) return interaction.followUp(payload);
  return interaction.reply(payload);
}
export function panelMessage() {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Vanta.vs Protector")
    .setDescription("Este panel controla el acceso al proyecto. Si eres comprador, utiliza los botones para canjear tu key, obtener tu script autorizado o solicitar tu rol.")
    .setFooter({ text: "Vanta.vs Protector · Panel de acceso" });
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

export function startDiscordBot() {
  if (started || !ENV.discordBotToken) {
    if (!ENV.discordBotToken) console.warn("[Discord Bot] DISCORD_BOT_TOKEN no está configurado; el Gateway no se inicia.");
    return;
  }
  started = true;
  client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
  client.once(Events.ClientReady, async (readyClient) => {
    try {
      const rest = new REST({ version: "10" }).setToken(ENV.discordBotToken);
      await rest.put(Routes.applicationCommands(readyClient.application.id), { body: discordCommands });
      console.log(`[Discord Bot] Online como ${readyClient.user.tag}; comandos slash sincronizados.`);
    } catch (error) { console.error("[Discord Bot] No se pudieron sincronizar los comandos slash:", error); }
  });
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isModalSubmit()) return handleModal(interaction);
      if (interaction.isButton()) return handleButton(interaction);
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName === "ping") return respond(interaction, { content: `Pong · ${Math.round(client?.ws.ping ?? 0)}ms`, ephemeral: true });
      if (interaction.commandName === "panel") return respond(interaction, panelMessage());
      if (interaction.commandName === "stats") return respond(interaction, { content: "Vanta.vs Protector está conectado. Usa el dashboard web para consultar scripts, licencias y actividad.", ephemeral: true });
      if (interaction.commandName === "getscript") return respond(interaction, { content: `📜 El acceso al script se gestiona desde tu panel privado: ${PANEL_URL}`, ephemeral: true });
      if (interaction.commandName === "getrole") return respond(interaction, { content: "👤 Canjea una key válida para solicitar el rol comprador.", ephemeral: true });
      if (interaction.commandName === "redeem") return redeem(interaction, interaction.options.getString("key", true));
      if (interaction.commandName === "resethwid") { await resetLicenseHwidByDiscordUserId(interaction.user.id); return respond(interaction, { content: "✅ Tu HWID fue reiniciado. Vuelve a ejecutar el loader para vincular el nuevo dispositivo.", ephemeral: true }); }
      if (interaction.commandName === "generatekeyrol") return configureKeyRole(interaction, interaction.options.getRole("role", true));
      if (interaction.commandName === "generatekey") return generate(interaction);
      if (interaction.commandName === "deletekey") return remove(interaction, interaction.options.getString("key", true));
      if (interaction.commandName === "whitelist") return whitelist(interaction, interaction.options.getString("id", true), interaction.options.getString("tipo", true) as "user" | "role");
      if (interaction.commandName === "unwhitelist") return unwhitelist(interaction, interaction.options.getString("id", true));
    } catch (error) {
      console.error("[Discord Bot] Interaction handler failed:", error);
      const currentInteraction = interaction as any;
      if (!currentInteraction.replied && !currentInteraction.deferred) await respond(currentInteraction, { content: "No se pudo completar la acción. Revisa la configuración del panel.", ephemeral: true });
    }
  });
  client.on(Events.Error, (error) => console.error("[Discord Bot] Gateway error:", error));
  client.login(ENV.discordBotToken).catch((error) => { started = false; console.error("[Discord Bot] No se pudo iniciar el Gateway:", error instanceof Error ? error.message : "error desconocido"); });
}

async function handleButton(interaction: ButtonInteraction) {
  if (interaction.customId === "vanta:redeem") {
    const modal = new ModalBuilder().setCustomId("vanta:redeem-modal").setTitle("Redeem Key");
    const input = new TextInputBuilder().setCustomId("key").setLabel("Key de 10 dígitos").setStyle(TextInputStyle.Short).setMinLength(10).setMaxLength(10).setRequired(true);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    return interaction.showModal(modal);
  }
  if (interaction.customId === "vanta:script") return respond(interaction, { content: `📜 Tu source nunca se publica en Discord. Si tienes acceso, consulta el script desde el panel privado: ${PANEL_URL}`, ephemeral: true });
  if (interaction.customId === "vanta:role") return respond(interaction, { content: "👤 El rol comprador se asigna después de validar una key. Canjea tu key primero.", ephemeral: true });
  if (interaction.customId === "vanta:hwid") { await resetLicenseHwidByDiscordUserId(interaction.user.id); return respond(interaction, { content: "✅ HWID reiniciado correctamente.", ephemeral: true }); }
  if (interaction.customId === "vanta:stats") return respond(interaction, { content: "📊 Para ver el estado de tu key y el script autorizado, abre el dashboard privado.", ephemeral: true });
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
  if (!owner || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return respond(interaction, { content: "⛔ Solo un administrador puede configurar este rol.", ephemeral: true });
  await setKeyManagerRole(owner.id, role.id);
  return respond(interaction, { content: `✅ El rol <@&${role.id}> ahora puede usar "/generatekey" y "/deletekey".`, ephemeral: true });
}
async function whitelist(interaction: any, discordId: string, kind: "user" | "role") {
  const owner = await ownerAccount();
  if (!owner || (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) && interaction.user.id !== owner.discordUserId)) return respond(interaction, { content: "⛔ Solo el propietario o un administrador puede modificar la whitelist.", ephemeral: true });
  const counts = await createAccessRuleIfAbsent({ ownerId: owner.id, kind, discordId: discordId.trim(), label: kind === "role" ? "Buyer role" : "Buyer user" });
  const rules = await getAccessRulesByOwner(owner.id);
  const channel = interaction.channelId ? `<#${interaction.channelId}>` : "canal actual";
  const embed = new EmbedBuilder().setColor(0x57f287).setTitle("✅ Whitelisted").setDescription(`Acceso concedido a **${kind === "role" ? `<@&${discordId}>` : `<@${discordId}>`}** para Vanta.vs Protector (forever).\n\n**Added:** ${counts.added} · **Already whitelisted:** ${counts.alreadyWhitelisted} · **Failed:** ${counts.failed}\n\nAccess the script via → ${channel}`).setFooter({ text: `Reglas activas: ${rules.length}` });
  return respond(interaction, { embeds: [embed] });
}
async function unwhitelist(interaction: any, discordId: string) {
  const owner = await ownerAccount();
  if (!owner || (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) && interaction.user.id !== owner.discordUserId)) return respond(interaction, { content: "⛔ Solo el propietario o un administrador puede modificar la whitelist.", ephemeral: true });
  const removed = await deleteAccessRuleByDiscordId(owner.id, discordId.trim());
  return respond(interaction, { content: removed ? `✅ Whitelist retirada para **${discordId.trim()}**.` : "No se encontró una regla activa para ese ID.", ephemeral: true });
}
async function generate(interaction: any) {
  const result = await canManageKeys(interaction);
  if (!canPerformKeyAction(interaction.user.id)) return respond(interaction, { content: "⏳ Espera unos segundos antes de gestionar otra key.", ephemeral: true });
  if (!result.allowed || !result.owner) return respond(interaction, { content: "⛔ No tienes permiso para generar keys.", ephemeral: true });
  const row = await createLicense({ ownerId: result.owner.id, keyCode: keyCode(), type: "license", status: "active", discordUserId: null, hwid: null, expiresAt: null, hostedScriptId: null });
  if (row) await createKeyAuditLog({ ownerId: result.owner.id, actorDiscordId: interaction.user.id, action: "generate", keyCode: row.keyCode });
  return respond(interaction, { content: row ? `🔑 Key generada: **${row.keyCode}**` : "No se pudo generar la key.", ephemeral: true });
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
