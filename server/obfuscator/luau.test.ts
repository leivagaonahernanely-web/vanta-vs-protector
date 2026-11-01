import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildLua } from "./build";

// Sintaxis de Luau que usan los scripts de Roblox. La salida ofuscada es Lua 5.1 estándar,
// así que se ejecuta con el intérprete de prueba y se compara con el valor esperado.
const LUA = process.env.NX_LUA_BIN ?? "lua5.1";
function luaAvailable(): boolean {
  try {
    execFileSync(LUA, ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const cases: [string, string, string][] = [
  ["+= -= *=", "local n = 1 n += 2 n -= 1 n *= 5 return n", "10"],
  ["..=", "local s = 'a' s ..= 'b' return s", "ab"],
  ["continue en for numérico", "local s=0 for i=1,5 do if i==3 then continue end s=s+i end return s", "12"],
  ["continue en while", "local i, s = 0, 0 while i < 5 do i = i + 1 if i % 2 == 0 then continue end s = s + i end return s", "9"],
  ["continue en for genérico", "local s=0 for _, v in ipairs({1,2,3,4}) do if v == 2 then continue end s=s+v end return s", "8"],
  ["continue en repeat", "local i, s = 0, 0 repeat i = i + 1 if i == 2 then continue end s = s + i until i >= 4 return s", "8"],
  ["!=", "return 1 != 2", "true"],
  ["// redondea hacia abajo", "return -7 // 2", "-4"],
  ["anotaciones de tipo", "local x: number = 5 local function f(a: string, b: number): number return #a + b end return x + f('ab', 1)", "8"],
  ["tipo de tabla", "local p: {x: number, y: number} = {x = 1, y = 2} return p.x + p.y", "3"],
  ["alias de tipo", "type Pair = {a: number}\nexport type Other = string | number\nlocal p: Pair = {a = 4} return p.a", "4"],
  ["genéricos", "local function id<T>(x: T): T return x end return id(9)", "9"],
  ["conversión de tipo", "local v = (5 :: number) return v", "5"],
  ["if como expresión", "local x = 1 local r = if x == 0 then 'a' elseif x == 1 then 'b' else 'c' return r", "b"],
  ["interpolación con backticks", "local n = 2 return `n={n} ok={n > 1}`", "n=2 ok=true"],
  ["escape \\u{}", 'return "\\u{41}"', "A"],
  ["escape \\x41", 'return "\\x41\\x42"', "AB"],
  ["guiones bajos y binario", "return 1_000 + 0b101", "1005"],
  ["escape \\z", 'return "a\\z    b"', "ab"],
  ["for con anotación", "local s = 0 for i: number = 1, 3 do s += i end return s", "6"],
  ["continue como nombre", "local continue = 4 return continue", "4"],
  ["for con paso variable", "local st=2 local s=0 for i=1,7,st do s=s+i end return s", "16"],
  ["for con paso variable negativo", "local st=-1 local s='' for i=3,1,st do s=s..i end return s", "321"],
  ["for con paso como expresión", "local s=0 for i=1,10,1+1 do s=s+i end return s", "25"],
];

describe("sintaxis de Luau", () => {
  const runIt = luaAvailable() ? it : it.skip;
  for (const [name, src, expected] of cases) {
    runIt(`ejecuta: ${name}`, () => {
      const { code } = buildLua(src, 7);
      const dir = mkdtempSync(join(tmpdir(), "nx-luau-"));
      try {
        const file = join(dir, "out.lua");
        writeFileSync(file, `local __r = (function()\n${code}\nend)()\nio.write(tostring(__r))\n`);
        expect(execFileSync(LUA, [file], { encoding: "utf8" })).toBe(expected);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }

  it("rechaza continue y break fuera de un bucle", () => {
    expect(() => buildLua("continue", 1)).toThrow(/'continue' fuera de un bucle/);
  });
});
