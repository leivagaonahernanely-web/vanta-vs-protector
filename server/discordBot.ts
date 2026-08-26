import { Client, Events, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import { ENV } from "./_core/env";

const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Verifica la latencia del bot").toJSON(),
  new SlashCommandBuilder().setName("panel").setDescription("Abre el panel web de Vanta.vs Protector").toJSON(),
  new SlashCommandBuilder().setName("stats").setDescription("Muestra el estado del servicio").toJSON(),
];

let started = false;
let client: Client | null = null;

export function startDiscordBot() {
  if (started || !ENV.discordBotToken) {
    if (!ENV.discordBotToken) console.warn("[Discord Bot] DISCORD_BOT_TOKEN no está configurado; el Gateway no se inicia.");
    return;
  }
  started = true;
  client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, async (readyClient) => {
    try {
      await readyClient.application.commands.set(commands);
      console.log(`[Discord Bot] Online como ${readyClient.user.tag}; comandos slash sincronizados.`);
    } catch (error) {
      console.error("[Discord Bot] No se pudieron sincronizar los comandos slash:", error);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === "ping") {
      await interaction.reply({ content: `Pong · ${Math.round(readyLatency(client))}ms`, ephemeral: true });
      return;
    }
    if (interaction.commandName === "panel") {
      await interaction.reply({ content: "Abre el panel de Vanta.vs Protector para gestionar scripts, keys, blacklist, whitelist y HWID.", ephemeral: true });
      return;
    }
    if (interaction.commandName === "stats") {
      await interaction.reply({ content: "Vanta.vs Protector está conectado. Consulta el dashboard web para ver las estadísticas completas.", ephemeral: true });
    }
  });

  client.on(Events.Error, (error) => console.error("[Discord Bot] Gateway error:", error));
  client.login(ENV.discordBotToken).catch((error) => {
    started = false;
    console.error("[Discord Bot] No se pudo iniciar el Gateway:", error instanceof Error ? error.message : "error desconocido");
  });
}

function readyLatency(currentClient: Client | null) {
  return currentClient?.ws.ping ?? 0;
}
