import { TRPCError } from "@trpc/server";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { CompileError, compile } from "./obfuscator/compiler";
import { emitLua } from "./obfuscator/emit";
import { LuaSyntaxError } from "./obfuscator/lexer";
import { parse } from "./obfuscator/parser";
import { encode } from "./obfuscator/vm";

export const MAX_SOURCE_BYTES = 2_000_000;

const obfuscateInput = z.object({
  source: z.string().min(1).max(MAX_SOURCE_BYTES),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => {
      const user = opts.ctx.user;
      if (!user) return user;
      return { ...user, isOwner: Boolean(ENV.ownerOpenId && user.openId === ENV.ownerOpenId && user.role === "admin") };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  obfuscator: router({
    // Compila la source Lua y devuelve un archivo autocontenido con la VM y el bytecode.
    // Cada ejecución usa una tabla de opcodes distinta.
    run: protectedProcedure.input(obfuscateInput).mutation(({ input }) => {
      try {
        const program = compile(parse(input.source));
        const bytecode = encode(program, randomInt(1, 2 ** 31));
        return { code: emitLua(bytecode) };
      } catch (error) {
        if (error instanceof LuaSyntaxError || error instanceof CompileError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
