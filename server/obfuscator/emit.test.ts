import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "./parser";
import { compile } from "./compiler";
import { emitLua } from "./emit";
import { encode, execute, LuaTable, tostr, type Env } from "./vm";

// Intérprete Lua 5.1 para la prueba de equivalencia. Configurable con NX_LUA_BIN.
const LUA = process.env.NX_LUA_BIN ?? "lua5.1";

function luaAvailable(): boolean {
  try {
    execFileSync(LUA, ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Entorno con la biblioteca mínima de strings, para la VM de TypeScript.
function tsEnv(): Env {
  const lib = new LuaTable();
  lib.hash.set("len", (s: unknown) => (s as string).length);
  lib.hash.set("upper", (s: unknown) => (s as string).toUpperCase());
  return { string: lib };
}

// Texto que imprimiría `print` en Lua 5.1 para el resultado de la VM de TypeScript.
function printed(v: unknown): string {
  if (v === null || v === undefined) return "nil";
  return tostr(v);
}

const PROGRAMS: string[] = [
  "return 1 + 2 * 3",
  "return -7 % 3",
  "return 7 / 2",
  'return "a" .. 1 .. "b"',
  "return 1 < 2 and 2 >= 2",
  "return nil or 5",
  "local x = 2 x = x * 5 return x",
  "local s = 0 for i = 1, 10 do s = s + i end return s",
  "local s = '' for i = 3, 1, -1 do s = s .. i end return s",
  "local i = 0 while true do i = i + 1 if i == 5 then break end end return i",
  "local n = 0 repeat local m = n n = n + 1 until m >= 3 return n",
  "local t = {10, 20, x = 'a'} return t[1] + t[2] .. t.x",
  "local t = {} t.a = 1 t[3] = 3 return #t + t.a",
  "local o = {n = 5} function o:suma(x) return self.n + x end return o:suma(3)",
  "local function fact(n) if n <= 1 then return 1 end return n * fact(n - 1) end return fact(6)",
  "local function contador() local n = 0 return function() n = n + 1 return n end end local c = contador() c() c() return c()",
  "local fs = {} for i = 1, 3 do fs[i] = function() return i end end return fs[1]() * 100 + fs[2]() * 10 + fs[3]()",
  "local a = {b = {}} function a.b.f(x) return x + 1 end return a.b.f(41)",
  'return ("abc"):len() + #"hola"',
  'return ("abc"):upper()',
  "x = 5 y = x * 2 return y",
  'local s = "hola mundo \\"ñ\\"" g = s .. "!" return g',
  // Capturas: parámetro capturado y mutado, captura de dos niveles y closures creadas en un bucle.
  "local function mk(x) return function() x = x + 1 return x end end local f = mk(10) f() return f()",
  "local a = 1 local function f() local function g() return a end return g() end a = 5 return f()",
  "local t = {} for i = 1, 3 do local j = i * 10 t[i] = function() j = j + 1 return j end end return t[1]() + t[1]() * 100 + t[3]()",
];

describe("emisión Lua: cadenas cifradas", () => {
  it("no deja en claro nombres globales ni constantes de texto del script", () => {
    const src = 'classifiedGlobal = "topsecret_text" .. "_more" return classifiedGlobal';
    const code = emitLua(encode(compile(parse(src)), 11), { printResult: true });
    expect(code).not.toContain("classifiedGlobal");
    expect(code).not.toContain("topsecret");
  });

  it("produce salidas distintas para semillas distintas", () => {
    const src = 'g = "x" return g';
    const a = emitLua(encode(compile(parse(src)), 1));
    const b = emitLua(encode(compile(parse(src)), 2));
    expect(a).not.toBe(b);
  });
});

describe("emisión Lua: equivalencia con la VM de referencia", () => {
  const available = luaAvailable();
  const runIt = available ? it : it.skip;

  it("reporta si hay intérprete Lua 5.1 disponible", () => {
    if (!available) console.warn(`[emit] sin intérprete Lua (NX_LUA_BIN=${LUA}); se omiten las pruebas de equivalencia`);
    expect(typeof available).toBe("boolean");
  });

  for (const src of PROGRAMS) {
    runIt(`ejecuta igual que la VM: ${src.slice(0, 60)}`, () => {
      const program = compile(parse(src));
      const bc = encode(program, 7);
      const expected = printed(execute(bc, tsEnv()));

      const dir = mkdtempSync(join(tmpdir(), "nx-emit-"));
      try {
        const file = join(dir, "out.lua");
        writeFileSync(file, emitLua(bc, { printResult: true }));
        const actual = execFileSync(LUA, [file], { encoding: "utf8" }).trimEnd();
        expect(actual).toBe(expected);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});
