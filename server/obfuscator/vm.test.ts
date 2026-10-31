import { describe, expect, it } from "vitest";
import { parse } from "./parser";
import { compile, CompileError } from "./compiler";
import { encode, execute, LuaTable, RuntimeError, type Env } from "./vm";

// Compila y ejecuta un fragmento con una semilla de opcodes dada.
function run(src: string, seed = 1, env: Env = {}) {
  return execute(encode(compile(parse(src)), seed), env);
}

describe("compilador + VM", () => {
  it("evalúa aritmética con precedencia", () => {
    expect(run("return 1 + 2 * 3")).toBe(7);
    expect(run("return (1 + 2) * 3")).toBe(9);
    expect(run("return -2 ^ 2")).toBe(-4);
    expect(run("return 7 % 3")).toBe(1);
    expect(run("return -7 % 3")).toBe(2);
    expect(run("return 7 / 2")).toBe(3.5);
  });

  it("maneja variables locales y globales", () => {
    const env: Env = {};
    run("local x = 2 x = x * 5 y = x return x", 1, env);
    expect(env.y).toBe(10);
    expect(run("local a, b = 1, 2 a, b = b, a return a - b")).toBe(1);
  });

  it("concatena cadenas y números como Lua", () => {
    expect(run('return "a" .. 1 .. "b"')).toBe("a1b");
    expect(run('return 1.5 .. ""')).toBe("1.5");
  });

  it("compara y aplica not", () => {
    expect(run("return 1 < 2")).toBe(true);
    expect(run('return "a" >= "b"')).toBe(false);
    expect(run("return not nil")).toBe(true);
    expect(run("return 1 == 1.0")).toBe(true);
    expect(() => run('return 1 < "2"')).toThrow(RuntimeError);
  });

  it("aplica cortocircuito en and y or", () => {
    expect(run("return nil or 5")).toBe(5);
    expect(run("return 0 and 9")).toBe(9); // 0 es verdadero en Lua
    expect(run("return false and undefinedFn()")).toBe(false);
    expect(run("return true or undefinedFn()")).toBe(true);
  });

  it("ejecuta if / elseif / else", () => {
    const src = (x: number) =>
      `local x = ${x} if x < 0 then return "neg" elseif x == 0 then return "cero" else return "pos" end`;
    expect(run(src(-1))).toBe("neg");
    expect(run(src(0))).toBe("cero");
    expect(run(src(3))).toBe("pos");
  });

  it("ejecuta while con break", () => {
    expect(run("local i = 0 while true do i = i + 1 if i == 5 then break end end return i")).toBe(5);
    expect(run("local i = 0 local s = 0 while i < 4 do i = i + 1 s = s + i end return s")).toBe(10);
  });

  it("ejecuta repeat-until con la condición en el mismo ámbito", () => {
    expect(run("local n = 0 repeat local m = n n = n + 1 until m >= 3 return n")).toBe(4);
  });

  it("ejecuta for numérico con paso positivo y negativo", () => {
    expect(run("local s = 0 for i = 1, 10 do s = s + i end return s")).toBe(55);
    expect(run("local s = 0 for i = 1, 10, 3 do s = s + i end return s")).toBe(22);
    expect(run("local s = '' for i = 3, 1, -1 do s = s .. i end return s")).toBe("321");
    expect(run("local s = 0 for i = 1, 100 do if i > 3 then break end s = s + i end return s")).toBe(6);
  });

  it("llama funciones nativas y deja el resultado nil cuando no devuelven nada", () => {
    const printed: unknown[][] = [];
    const env: Env = { print: (...args: unknown[]) => { printed.push(args); } };
    expect(run('print("hola", 2) return print()', 1, env)).toBe(null);
    expect(printed).toEqual([["hola", 2], []]);
  });

  it("produce el mismo resultado con distintas semillas de opcodes", () => {
    const src = "local s = 0 for i = 1, 10 do if i % 2 == 0 then s = s + i end end return s";
    const tables = [1, 2, 3].map((seed) => encode(compile(parse(src)), seed).opTable.join(","));
    expect(new Set(tables).size).toBeGreaterThan(1);
    for (const seed of [1, 2, 3, 42]) expect(run(src, seed)).toBe(30);
  });

  it("corta programas que no terminan", () => {
    expect(() => execute(encode(compile(parse("while true do end")), 1), {}, 10_000)).toThrow(/límite de ejecución/);
  });

  it("rechaza '...' fuera de una función vararg y break fuera de un bucle", () => {
    expect(() => compile(parse("local function f() return ... end"))).toThrow(/vararg/);
    expect(() => compile(parse("break"))).toThrow(/fuera de un bucle/);
  });
});

describe("tablas", () => {
  it("construye tablas posicionales, con nombre y con clave", () => {
    expect(run("local t = {10, 20, x = 'a', ['y'] = 'b'} return t[1] + t[2]")).toBe(30);
    expect(run("local t = {x = 'a', ['y'] = 'b'} return t.x .. t.y")).toBe("ab");
  });

  it("lee y escribe campos con punto y con corchetes", () => {
    expect(run("local t = {} t.a = 1 t['b'] = 2 t[3] = 3 return t.a + t.b + t[3]")).toBe(6);
    expect(run("local t = {v = 1} t.v = nil return t.v")).toBe(null);
  });

  it("calcula la longitud de una tabla secuencial y de un string", () => {
    expect(run("return #{1, 2, 3}")).toBe(3);
    expect(run('return #"hola"')).toBe(4);
  });

  it("asigna varios destinos incluyendo campos", () => {
    expect(run("local t = {} local a t.x, a = 1, 2 return t.x * 10 + a")).toBe(12);
  });

  it("usa métodos con dos puntos", () => {
    expect(run("local o = {n = 5} function o:suma(x) return self.n + x end return o:suma(3)")).toBe(8);
  });

  it("resuelve métodos de strings con la tabla string del entorno", () => {
    const lib = new LuaTable();
    lib.hash.set("len", (s: unknown) => (s as string).length);
    expect(run('return ("abc"):len()', 1, { string: lib })).toBe(3);
  });
});

describe("funciones y closures", () => {
  it("llama funciones de usuario con parámetros y retorno", () => {
    expect(run("local function sq(x) return x * x end return sq(7)")).toBe(49);
    expect(run("function doble(x) return x * 2 end return doble(4)")).toBe(8);
  });

  it("soporta recursión", () => {
    expect(run("local function fact(n) if n <= 1 then return 1 end return n * fact(n - 1) end return fact(6)")).toBe(720);
  });

  it("devuelve nil cuando la función no retorna nada", () => {
    expect(run("local function f() end return f()")).toBe(null);
  });

  it("captura variables en closures que conservan su estado", () => {
    const src = `
      local function contador()
        local n = 0
        return function() n = n + 1 return n end
      end
      local c = contador()
      c() c()
      return c()`;
    expect(run(src)).toBe(3);
  });

  it("crea una variable nueva por vuelta de bucle", () => {
    const src = `
      local fs = {}
      for i = 1, 3 do fs[i] = function() return i end end
      return fs[1]() * 100 + fs[2]() * 10 + fs[3]()`;
    expect(run(src)).toBe(123);
  });

  it("funciona con métodos definidos sobre tablas anidadas", () => {
    const src = `
      local a = {b = {}}
      function a.b.f(x) return x + 1 end
      return a.b.f(41)`;
    expect(run(src)).toBe(42);
  });

  it("corta la recursión infinita", () => {
    expect(() => run("local function f() return f() end return f()")).toThrow(/desbordamiento/);
  });

  it("indica error al llamar algo que no es función", () => {
    expect(() => run("local x = 1 return x()")).toThrow(/llamar a un valor de tipo number/);
  });
});
