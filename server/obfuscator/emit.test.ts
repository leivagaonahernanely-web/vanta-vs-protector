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
  // select como en Lua 5.1: select("#", ...) cuenta; select(n, ...) devuelve el n-ésimo.
  const select = (n: unknown, ...rest: unknown[]) => (n === "#" ? rest.length : (rest[(n as number) - 1] ?? null));
  return { string: lib, select };
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
  "local t = {} for i = 1, 3 do local j = i * 10 t[i] = function() j = j + 1 return j end end return t[1]() + t[1]() * 100 + t[3]()",  // For genérico, varargs, retornos múltiples y listas variables.
  "local function it(t, i) i = i + 1 if t[i] ~= nil then return i, t[i] end return nil end local function each(t) return it, t, 0 end local s = 0 for i, v in each({10, 20, 30}) do s = s + i * v end return s",
  "local function sum(...) local s = 0 for i = 1, select('#', ...) do s = s + select(i, ...) end return s end return sum(1, 2, 3)",
  "local function two() return 1, 2 end local a, b = two() return a * 10 + b",
  "local function two() return 1, 2 end local t = {two(), two()} return #t",
  "local function two() return 3, 4 end local function fwd() return two() end local a, b = fwd() return a + b",
  "local o = {} function o:count(...) return select('#', ...) end local function two() return 1, 2 end return o:count(7, two())",
  "local function pk(...) return {...} end local t = pk(5, 6, 7) return t[1] + t[3]",
  "local function f(a, b) return a, b end local x, y, z = f(1) return (x or 0) + (y or 0) * 10 + (z or 0) * 100",
  "local function gen() local i = 0 return function() i = i + 1 if i <= 3 then return i end end end local s = 0 for v in gen() do s = s + v end return s",
  "local function f(...) local a, b = ... return a + b end return f(4, 5, 6)",
  "local function g(...) return ... end local x, y = g(8, 9) return x * y",
  "local function it(t, i) i = i + 1 if t[i] then return i end end local n = 0 for i in it, {1, 2, 3, 4}, 0 do if i == 3 then break end n = n + i end return n",
  // Metatablas: herencia con __index, __newindex, sobrecarga de operadores, __call, __tostring.
  "local Animal = {} Animal.__index = Animal function Animal.new(n) return setmetatable({name = n}, Animal) end function Animal:speak() return self.name .. ' habla' end local a = Animal.new('gato') return a:speak()",
  "local Base = {} Base.__index = Base function Base:greet() return 'base' end local Child = setmetatable({}, {__index = Base}) Child.__index = Child local c = setmetatable({}, Child) return c:greet()",
  "local t = setmetatable({}, {__index = function(_, k) return 'def:' .. k end}) return t.missing",
  "local log = {} local t = setmetatable({}, {__newindex = function(_, k, v) log[#log + 1] = k end}) t.x = 1 t.y = 2 return log[1] .. log[2]",
  "local mt = {__add = function(a, b) return a.v + b.v end} local a = setmetatable({v = 3}, mt) local b = setmetatable({v = 4}, mt) return a + b",
  "local mt = {__eq = function(a, b) return a.v == b.v end} local a = setmetatable({v = 1}, mt) local b = setmetatable({v = 1}, mt) return a == b",
  "local mt = {__lt = function(a, b) return a.v < b.v end} local a = setmetatable({v = 1}, mt) local b = setmetatable({v = 2}, mt) return a < b and 1 or 0",
  "local mt = {__concat = function(a, b) return 'cc' end} local a = setmetatable({}, mt) return a .. 'x'",
  "local mt = {__call = function(self, x) return x * 2 end} local t = setmetatable({}, mt) return t(21)",
  "local mt = {__tostring = function() return 'custom' end} local t = setmetatable({}, mt) return tostring(t)",
  "local mt = {__len = function() return 7 end} local t = setmetatable({}, mt) return #t",
  "local t = setmetatable({}, {__index = {x = 5}}) return rawget(t, 'x')",
  // Llamadas directas: argumentos faltantes no deben leer valores viejos de la pila.
  "local function big(a, b, c) return a + b + c end big(1, 2, 3) local function f(a, b) return b end return f(7)",
  "local function f(a, b, c) return c end return f(1, nil, 3)",
  "local function v(...) return select('#', ...) end return v(1, nil, nil)",
  "local function w(a, ...) return ... end local x, y = w(1, 2, 3) return x + y",
  "local function cnt(...) local n = 0 for i = 1, select('#', ...) do n = n + 1 end return n end return cnt(4, 5, 6, 7)",
  // Módulo y división con negativos y flotantes (operandos en variables para no plegarlos).
  "local a, b = 7, -3 return a % b",
  "local a, b = -7, 3 return a % b",
  "local a, b = 7.5, 2 return (a % b) * 10 + a / b",
  "local a = 7 return a / 2 % 3",
  // Plegado de constantes: deben dar el mismo resultado que la ejecución real.
  "return (2 * 3 + 1) + (-2 ^ 2) * 100 + (7 % 3) * 10000",
  "return (2 == 2) and (3 < 2) == false",
  "return (1 + 2) * (3 - 1) / 4 + -(5 % 3) * 10",
  "local x = 2 * 3 return x + 4 - 1 * 2",
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
        // La VM de referencia guarda cadenas como bytes (un carácter por byte); Lua imprime UTF-8.
        expect(actual).toBe(Buffer.from(expected, "latin1").toString("utf8"));
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }

  // Sin el metamétodo correspondiente, el runtime emitido debe fallar con su propio mensaje
  // (no uno genérico del motor de Lua), igual que la VM de referencia.
  const ERROR_PROGRAMS: [string, RegExp][] = [
    ["return {} + 1", /sumar/],
    ["local t = {} return t()", /llamar a un valor de tipo table/],
    ["return {} < {}", /comparar/],
    ["return {} .. 'x'", /concatenar/],
    ["return -{}", /negar/],
  ];

  for (const [src, msg] of ERROR_PROGRAMS) {
    runIt(`falla con su propio mensaje sin metamétodo: ${src}`, () => {
      const bc = encode(compile(parse(src)), 7);
      const dir = mkdtempSync(join(tmpdir(), "nx-emit-err-"));
      try {
        const file = join(dir, "out.lua");
        writeFileSync(file, emitLua(bc, { printResult: true }));
        let failed = false;
        try {
          execFileSync(LUA, [file], { encoding: "utf8" }); // el mensaje de error sale por stdout
        } catch (e) {
          failed = true;
          const output = (e as { stdout?: string }).stdout ?? "";
          expect(output).toMatch(msg);
        }
        expect(failed).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});
