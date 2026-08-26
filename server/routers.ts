import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { notifyOwner } from "./_core/notification";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createHostedScript, createProtection, getHostedScriptsByUser, getProtectionsByUser, updateDiscordChannelId } from "./db";
import { nanoid } from "nanoid";
import { sendDiscordChannelMessage } from "./discord";
import { buildProtectionArtifact, getProviderStatus } from "./protection";

const hostedScriptInput = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(500).optional(),
  source: z.string().min(1).max(150_000),
  ffaMode: z.boolean().default(false),
  obfuscateSource: z.boolean().default(true),
});

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
        loader: `loadstring(game:HttpGet("${origin}/scripts/hosted/${row.slug}"))()`,
      }));
    }),
    create: protectedProcedure.input(hostedScriptInput).mutation(async ({ ctx, input }) => {
      const artifact = buildProtectionArtifact(input.source, {
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
        code: artifact.code,
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
        loader: `loadstring(game:HttpGet("${url}"))()`,
      };
    }),
  }),

  protections: router({
    providerStatus: publicProcedure.query(() => getProviderStatus()),

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
        artifact = buildProtectionArtifact(input.source, {
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
