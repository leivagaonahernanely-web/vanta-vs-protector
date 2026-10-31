import { describe, expect, it } from "vitest";
import { parse } from "./parser";
import { compile, CompileError } from "./compiler";
import { encode, execute, RuntimeError, type Env } from "./vm";

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

  it("rechaza lo que aún no soporta el subconjunto", () => {
    expect(() => compile(parse("local t = {}"))).toThrow(CompileError);
    expect(() => compile(parse("local t = {} return t.x"))).toThrow(/tablas/);
    expect(() => compile(parse("function f() end"))).toThrow(/funciones de usuario/);
    expect(() => compile(parse("return ...", ))).toThrow(/varargs/);
    expect(() => compile(parse("return 1, 2"))).toThrow(/un valor de retorno/);
    expect(() => compile(parse("break"))).toThrow(/fuera de un bucle/);
  });
});
