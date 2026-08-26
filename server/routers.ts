import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { notifyOwner } from "./_core/notification";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createAccessRule, createBlacklist, createHostedScript, createLicense, createProtection, deleteAccessRule, deleteBlacklist, deleteLicense, getAccessRulesByOwner, getBlacklistsByOwner, getHostedScriptSourceByUser, getHostedScriptsByUser, getLicensesByOwner, getProtectionsByUser, resetLicenseHwid, revokeLicense, updateDiscordChannelId } from "./db";
import { nanoid } from "nanoid";
import { randomInt } from "node:crypto";
import { getDiscordBotIdentity, sendDiscordChannelMessage } from "./discord";
import { getProtectionAdapterStatus, getProviderStatus, protectWithAdapter } from "./protection";

const hostedScriptInput = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(500).optional(),
  source: z.string().min(1).max(150_000),
  ffaMode: z.boolean().default(false),
  scriptKey: z.string().trim().regex(/^[A-Za-z0-9_-]{8,128}$/).optional(),
  obfuscateSource: z.boolean().default(true),
});

function buildRuntimeLoader(url: string, scriptKey?: string | null) {
  const load = `loadstring(game:HttpGet(\"${url}\"))()`;
  return scriptKey ? `script_key = \"${scriptKey}\"\n${load}` : load;
}

const licenseInput = z.object({
  type: z.enum(["trial", "license"]).default("license"),
  hostedScriptId: z.number().int().positive().optional(),
  discordUserId: z.string().regex(/^\d{15,22}$/).optional(),
  trialDays: z.number().int().min(1).max(30).default(3),
});
const accessRuleInput = z.object({ kind: z.enum(["user", "role"]), discordId: z.string().regex(/^\d{15,22}$/), label: z.string().trim().max(128).optional() });
const blacklistInput = z.object({ discordUserId: z.string().regex(/^\d{15,22}$/), reason: z.string().trim().max(500).optional() });

function generateKeyCode() { return String(randomInt(1_000_000_000, 10_000_000_000)); }

const protectionInput = z.object({
  name: z.string().trim().min(1).max(255),
  source: z.string().min(1).max(150_000),
  mode: z.enum(["fast", "balanced", "fortified"]),
  obfuscateStrings: z.boolean(),
  addLoaderGuard: z.boolean(),
  discordChannelId: z.string().trim().regex(/^\d{15,22}$/).optional(),
});

function toClientRecord(row: NonNullable<Awaited<ReturnType<typeof createProtection>>>) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    checksum: row.checksum,
    code: row.resultCode ?? "",
    createdAt: row.createdAt.toISOString(),
    message: row.message ?? "",
  };
}

export const appRouter = router({
  system: systemRouter,
  discord: router({
    status: publicProcedure.query(async () => {
      const identity = await getDiscordBotIdentity();
      return identity ? { online: true, username: identity.username } : { online: false, username: null };
    }),
    updateChannel: protectedProcedure.input(z.object({ discordChannelId: z.string().regex(/^\d{15,22}$/).nullable() })).mutation(({ ctx, input }) => updateDiscordChannelId(ctx.user.id, input.discordChannelId)),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  hostedScripts: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const origin = `${ctx.req.protocol}://${ctx.req.get("host")}`;
      const rows = await getHostedScriptsByUser(ctx.user.id);
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description ?? "",
        ffaMode: Boolean(row.ffaMode),
        createdAt: row.createdAt.toISOString(),
        url: `${origin}/scripts/hosted/${row.slug}`,
        loader: buildRuntimeLoader(`${origin}/scripts/hosted/${row.slug}`, row.scriptKey),
        scriptKey: row.scriptKey,
      }));
    }),
    source: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const row = await getHostedScriptSourceByUser(ctx.user.id, input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Script no encontrado." });
      return row;
    }),
    create: protectedProcedure.input(hostedScriptInput).mutation(async ({ ctx, input }) => {
      const artifact = await protectWithAdapter(input.source, {
        mode: "balanced",
        obfuscateStrings: input.obfuscateSource,
        addLoaderGuard: true,
      });
      const slug = nanoid(18);
      const row = await createHostedScript({
        userId: ctx.user.id,
        slug,
        name: input.name,
        description: input.description || null,
        ffaMode: input.ffaMode ? 1 : 0,
        scriptKey: input.scriptKey || null,
        code: artifact.code,
        sourceCode: input.source,
      });
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo alojar el script." });
      const origin = `${ctx.req.protocol}://${ctx.req.get("host")}`;
      const url = `${origin}/scripts/hosted/${row.slug}`;
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description ?? "",
        ffaMode: Boolean(row.ffaMode),
        createdAt: row.createdAt.toISOString(),
        url,
        loader: buildRuntimeLoader(url, row.scriptKey),
        scriptKey: row.scriptKey,
      };
    }),
  }),

  licenseKeys: router({
    list: protectedProcedure.query(({ ctx }) => getLicensesByOwner(ctx.user.id)),
    generate: protectedProcedure.input(licenseInput).mutation(async ({ ctx, input }) => {
      const expiresAt = input.type === "trial" ? new Date(Date.now() + input.trialDays * 86_400_000) : null;
      const row = await createLicense({ ownerId: ctx.user.id, hostedScriptId: input.hostedScriptId ?? null, keyCode: generateKeyCode(), type: input.type, status: "active", discordUserId: input.discordUserId ?? null, hwid: null, expiresAt });
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo generar la licencia." });
      return row;
    }),
    revoke: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => revokeLicense(ctx.user.id, input.id)),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteLicense(ctx.user.id, input.id)),
    resetHwid: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => resetLicenseHwid(ctx.user.id, input.id)),
  }),

  access: router({
    blacklist: router({
      list: protectedProcedure.query(({ ctx }) => getBlacklistsByOwner(ctx.user.id)),
      add: protectedProcedure.input(blacklistInput).mutation(({ ctx, input }) => createBlacklist({ ownerId: ctx.user.id, discordUserId: input.discordUserId, reason: input.reason ?? null, active: 1 })),
      remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteBlacklist(ctx.user.id, input.id)),
    }),
    whitelist: router({
      list: protectedProcedure.query(({ ctx }) => getAccessRulesByOwner(ctx.user.id)),
      add: protectedProcedure.input(accessRuleInput).mutation(({ ctx, input }) => createAccessRule({ ownerId: ctx.user.id, kind: input.kind, discordId: input.discordId, label: input.label ?? null, active: 1 })),
      remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteAccessRule(ctx.user.id, input.id)),
    }),
  }),

  protections: router({
    providerStatus: publicProcedure.query(() => ({ ...getProviderStatus(), adapter: getProtectionAdapterStatus() })),

    history: protectedProcedure.query(async ({ ctx }) => {
      const rows = await getProtectionsByUser(ctx.user.id);
      return rows.map(toClientRecord);
    }),

    create: protectedProcedure.input(protectionInput).mutation(async ({ ctx, input }) => {
      const channelId = input.discordChannelId ?? ctx.user.discordChannelId ?? undefined;
      if (input.discordChannelId && input.discordChannelId !== ctx.user.discordChannelId) {
        await updateDiscordChannelId(ctx.user.id, input.discordChannelId);
      }
      let artifact;
      try {
        artifact = await protectWithAdapter(input.source, {
          mode: input.mode,
          obfuscateStrings: input.obfuscateStrings,
          addLoaderGuard: input.addLoaderGuard,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido durante la protección.";
        const failed = await createProtection({
          userId: ctx.user.id,
          name: input.name,
          sourceSize: Buffer.byteLength(input.source, "utf8"),
          status: "failed",
          mode: input.mode,
          obfuscateStrings: input.obfuscateStrings ? 1 : 0,
          addLoaderGuard: input.addLoaderGuard ? 1 : 0,
          checksum: "0000000000000000",
          resultCode: null,
          message,
        });
        const alert = {
          title: "Vanta.vs Protector: protección fallida",
          content: `La protección de ${input.name} falló para ${ctx.user.name ?? ctx.user.email ?? "un usuario"}. Motivo: ${message}`,
        };
        const [ownerSent, discordSent] = await Promise.all([
          notifyOwner(alert).catch(() => false),
          sendDiscordChannelMessage(channelId, alert),
        ]);
        if (!ownerSent && !discordSent) console.error("[Alerts] All notification channels failed for protection error");
        if (!failed) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo registrar el fallo." });
        return toClientRecord(failed);
      }

      const row = await createProtection({
        userId: ctx.user.id,
        name: input.name,
        sourceSize: Buffer.byteLength(input.source, "utf8"),
        status: artifact.status,
        mode: input.mode,
        obfuscateStrings: input.obfuscateStrings ? 1 : 0,
        addLoaderGuard: input.addLoaderGuard ? 1 : 0,
        checksum: artifact.checksum,
        resultCode: artifact.code,
        message: artifact.message,
      });
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo guardar la protección." });

      if (artifact.status === "review") {
        const alert = {
          title: "Vanta.vs Protector: revisión requerida",
          content: `La protección ${input.name} requiere revisión preventiva. Checksum: ${artifact.checksum}. Usuario: ${ctx.user.name ?? ctx.user.email ?? "desconocido"}.`,
        };
        const [ownerSent, discordSent] = await Promise.all([
          notifyOwner(alert).catch(() => false),
          sendDiscordChannelMessage(channelId, alert),
        ]);
        if (!ownerSent && !discordSent) console.error("[Alerts] All notification channels failed for review");
      }
      return toClientRecord(row);
    }),
  }),
});

export type AppRouter = typeof appRouter;
