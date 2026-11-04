// Inyecta código muerto protegido por predicados opacos: `if (a*a) % 4 == 2 then ... end`.
// Para cualquier entero a, a*a % 4 es 0 o 1, así que la rama nunca se ejecuta, pero el
// analizador estático no lo sabe sin razonar sobre aritmética modular. Va solo en bloques
// protegidos, que se compilan a bytecode, así que el código falso queda dentro de la VM.
import type { Block, Stmt } from "./parser";

const STMT_KINDS = new Set([
  "Local", "Assign", "CallStmt", "Do", "While", "Repeat", "If", "NumericFor", "GenericFor",
  "FunctionDecl", "LocalFunction", "Return", "Break", "Continue",
]);

// Generador pseudoaleatorio determinista (mulberry32): misma semilla, mismo resultado.
function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isStmt(v: unknown): v is Stmt {
  return typeof v === "object" && v !== null && STMT_KINDS.has((v as { kind: string }).kind);
}

function deadBranch(line: number, a: number, b: number): Stmt {
  // (a*a) % 4 == 2 nunca es cierto para enteros a.
  const cond = {
    kind: "Binary" as const,
    op: "==",
    left: {
      kind: "Binary" as const,
      op: "%",
      left: { kind: "Binary" as const, op: "*", left: { kind: "Number" as const, value: a }, right: { kind: "Number" as const, value: a }, line },
      right: { kind: "Number" as const, value: 4 },
      line,
    },
    right: { kind: "Number" as const, value: 2 },
    line,
  };
  const body: Block = [
    { kind: "Local", names: ["nx_d"], values: [{ kind: "Binary", op: "+", left: { kind: "Number", value: b }, right: { kind: "Number", value: 1 }, line }], line },
  ];
  return { kind: "If", clauses: [{ cond, body }], orElse: null, line };
}

// Recorre el AST y, en cada bloque, inserta ramas muertas con probabilidad `rate`. Modifica el árbol.
export function injectDeadCode(block: Block, seed: number, rate: number): Block {
  const rand = prng(seed);

  const transformBlock = (b: Block): Block => {
    const out: Stmt[] = [];
    for (const s of b) {
      if (rand() < rate) {
        const a = 2 + Math.floor(rand() * 999);
        const c = Math.floor(rand() * 1000);
        out.push(deadBranch((s as { line?: number }).line ?? 1, a, c));
      }
      out.push(walk(s) as Stmt);
    }
    return out;
  };

  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      if (v.length > 0 && isStmt(v[0])) return transformBlock(v as Block);
      return v.map(walk);
    }
    if (typeof v === "object" && v !== null) {
      const obj = v as Record<string, unknown>;
      for (const key of Object.keys(obj)) obj[key] = walk(obj[key]);
      return obj;
    }
    return v;
  };

  return transformBlock(block);
}
