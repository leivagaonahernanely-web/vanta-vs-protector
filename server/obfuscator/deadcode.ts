// Inyecta código muerto protegido por predicados opacos: `if (a*a) % 4 == 2 then ... end`.
// Para cualquier entero a, a*a % 4 es 0 o 1, así que la rama nunca se ejecuta, pero el
// analizador estático no lo sabe sin razonar sobre aritmética modular. Va solo en bloques
// protegidos, que se compilan a bytecode, así que el código falso queda dentro de la VM.
import type { Block, Expr, Stmt } from "./parser";

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

// Nodo binario que el compilador no debe plegar: si el predicado se calculara al compilar, la rama
// quedaría como una constante `false` visible en el bytecode. Así se queda como operación en ejecución.
function opaqueBinary(op: string, left: Expr, right: Expr, line: number): Expr {
  return { kind: "Binary", op, left, right, line, opaque: true } as unknown as Expr;
}

function deadBranch(line: number, a: number, b: number): Stmt {
  // (a*a) % 4 == 2 nunca es cierto para enteros a.
  const num = (value: number): Expr => ({ kind: "Number", value } as Expr);
  const cond = opaqueBinary(
    "==",
    opaqueBinary("%", opaqueBinary("*", num(a), num(a), line), num(4), line),
    num(2),
    line,
  );
  const body: Block = [
    { kind: "Local", names: ["nx_d"], values: [opaqueBinary("+", num(b), num(1), line)], line },
  ];
  return { kind: "If", clauses: [{ cond, body }], orElse: null, line };
}

// Recorre el AST y, en cada bloque, inserta ramas muertas con probabilidad `rate`. Modifica el árbol.
// Solo se inserta en sentencias de nivel principal, que se ejecutan una vez. Dentro de bucles y de
// funciones la guarda se ejecutaría en cada vuelta o en cada llamada: el costo en la VM crece con
// las iteraciones, y según la semilla puede duplicar el tiempo de una función caliente.
const HOT_KINDS = new Set(["While", "Repeat", "NumericFor", "GenericFor", "Function"]);

export function injectDeadCode(block: Block, seed: number, rate: number): Block {
  const rand = prng(seed);
  let hotDepth = 0;

  const transformBlock = (b: Block): Block => {
    const out: Stmt[] = [];
    for (const s of b) {
      if (hotDepth === 0 && rand() < rate) {
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
      const hot = HOT_KINDS.has(String(obj.kind));
      if (hot) hotDepth++;
      for (const key of Object.keys(obj)) obj[key] = walk(obj[key]);
      if (hot) hotDepth--;
      return obj;
    }
    return v;
  };

  return transformBlock(block);
}
