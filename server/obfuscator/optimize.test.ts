import { describe, expect, it } from "vitest";
import { compile } from "./compiler";
import { injectDeadCode } from "./deadcode";
import { parse } from "./parser";

const opsOf = (src: string) => compile(parse(src)).protos[0].code.map((i) => i.op);

describe("plegado de constantes", () => {
  it("calcula operaciones entre literales en tiempo de compilación", () => {
    expect(opsOf("return 2 * 3 + 1")).not.toContain("BIN");
    expect(opsOf("return 7 % 3 == 1")).not.toContain("BIN");
    expect(opsOf("return -2 ^ 2")).not.toContain("UN");
  });

  it("no pliega resultados que no son finitos: se evalúan en ejecución", () => {
    expect(opsOf("return 1 / 0")).toContain("BIN");
    expect(opsOf("return 5 % 0")).toContain("BIN");
  });

  it("no toca operaciones con variables", () => {
    expect(opsOf("local x = 2 return x * 3")).toContain("BIN");
  });
});

describe("código muerto (dead code)", () => {
  it("el predicado opaco no se pliega: sigue como operaciones en el bytecode", () => {
    const out = injectDeadCode(parse("x = 1"), 1, 1);
    const code = compile(out).protos[0].code;
    // La guarda (el JMPF) debe venir justo después de la comparación calculada en ejecución.
    const jump = code.findIndex((i) => i.op === "JMPF");
    expect(jump).toBeGreaterThan(0);
    expect(code[jump - 1].op).toBe("BIN");
  });

  const isIf = (s: { kind: string }) => s.kind === "If";

  it("no inserta ramas dentro de bucles", () => {
    const block = parse("for i = 1, 3 do x = i y = i end");
    const out = injectDeadCode(block, 1, 1) as unknown as { kind: string; body?: { kind: string }[] }[];
    const loop = out.find((s) => s.kind === "NumericFor");
    expect(loop?.body?.some(isIf)).toBe(false);
  });

  it("no inserta ramas dentro de funciones", () => {
    const block = parse("local function f(a) x = a y = a end");
    const out = injectDeadCode(block, 1, 1) as unknown as { kind: string; fn?: { body: { kind: string }[] } }[];
    const fn = out.find((s) => s.kind === "LocalFunction")?.fn;
    expect(fn?.body.some(isIf)).toBe(false);
  });

  it("sí inserta ramas fuera de bucles", () => {
    const block = parse("x = 1 y = 2");
    const out = injectDeadCode(block, 1, 1) as unknown as { kind: string }[];
    expect(out.some(isIf)).toBe(true);
  });
});
