// Codificador y ejecutor de bytecode. El codificador asigna a cada operación un número
// distinto según una semilla, así que cada script tiene su propia tabla de opcodes.
// Esta VM de referencia en TypeScript define la semántica que luego replicará el runtime en Lua.
import type { Program } from "./compiler";

export const OP_NAMES = [
  "CONST", "LOCAL_GET", "LOCAL_SET", "GLOBAL_GET", "GLOBAL_SET", "BIN", "UN",
  "JMP", "JMPF", "JMPT", "DUP", "POP", "CALL", "RET",
] as const;
export type OpName = (typeof OP_NAMES)[number];

export type Bytecode = {
  // Pares [id de operación, argumento] ya ofuscados.
  code: number[];
  // Tabla id -> nombre de operación. En el runtime real esta tabla va cifrada.
  opTable: OpName[];
  consts: Program["consts"];
  names: string[];
  ops: string[];
  slots: number;
};

export type Env = Record<string, unknown>;

// Generador pseudoaleatorio determinista (mulberry32) para que la misma semilla dé el mismo mapa.
function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function encode(program: Program, seed: number): Bytecode {
  const rand = prng(seed);
  const opTable = [...OP_NAMES];
  for (let i = opTable.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [opTable[i], opTable[j]] = [opTable[j], opTable[i]];
  }
  const idOf = new Map(opTable.map((name, id) => [name, id]));

  const code: number[] = [];
  for (const instr of program.code) {
    code.push(idOf.get(instr.op as OpName)!, "a" in instr ? instr.a : 0);
  }
  return { code, opTable, consts: program.consts, names: program.names, ops: program.ops, slots: program.slots };
}

export class RuntimeError extends Error {}

const DEFAULT_MAX_STEPS = 1_000_000;

export function execute(bc: Bytecode, env: Env, maxSteps = DEFAULT_MAX_STEPS): unknown {
  const stack: unknown[] = [];
  const locals: unknown[] = new Array(bc.slots).fill(null);
  const push = (v: unknown) => { stack.push(v); };
  const pop = (): unknown => {
    if (stack.length === 0) throw new RuntimeError("pila vacía");
    return stack.pop();
  };

  let pc = 0;
  let steps = 0;
  while (true) {
    if (++steps > maxSteps) throw new RuntimeError("límite de ejecución superado");
    const id = bc.code[pc * 2];
    const a = bc.code[pc * 2 + 1];
    pc++;
    const op = bc.opTable[id];

    switch (op) {
      case "CONST": push(bc.consts[a]); break;
      case "LOCAL_GET": push(locals[a]); break;
      case "LOCAL_SET": locals[a] = pop(); break;
      case "GLOBAL_GET": push(env[bc.names[a]] ?? null); break;
      case "GLOBAL_SET": env[bc.names[a]] = pop(); break;
      case "BIN": {
        const right = pop();
        const left = pop();
        push(binary(bc.ops[a], left, right));
        break;
      }
      case "UN": push(unary(bc.ops[a], pop())); break;
      case "JMP": pc = a; break;
      case "JMPF": if (!truthy(pop())) pc = a; break;
      case "JMPT": if (truthy(pop())) pc = a; break;
      case "DUP": { const v = pop(); push(v); push(v); break; }
      case "POP": pop(); break;
      case "CALL": {
        const args: unknown[] = [];
        for (let i = 0; i < a; i++) args.unshift(pop());
        const fn = pop();
        if (typeof fn !== "function") throw new RuntimeError(`se intentó llamar a un valor de tipo ${typeName(fn)}`);
        const result = fn(...args);
        push(result === undefined ? null : result);
        break;
      }
      case "RET": return pop();
      default: throw new RuntimeError(`operación desconocida ${id}`);
    }
  }
}

export function truthy(v: unknown): boolean {
  return v !== null && v !== undefined && v !== false;
}

function typeName(v: unknown): string {
  if (v === null || v === undefined) return "nil";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return "number";
  if (typeof v === "string") return "string";
  return "function";
}

// Convierte a texto como lo hace Lua 5.1 para números (%.14g).
export function tostr(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") {
    if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
    return String(Number(v.toPrecision(14)));
  }
  if (v === null || v === undefined) return "nil";
  return String(v);
}

function num(v: unknown, op: string): number {
  if (typeof v === "number") return v;
  throw new RuntimeError(`intento de ${op} sobre un valor de tipo ${typeName(v)}`);
}

function binary(op: string, l: unknown, r: unknown): unknown {
  switch (op) {
    case "+": return num(l, "suma") + num(r, "suma");
    case "-": return num(l, "resta") - num(r, "resta");
    case "*": return num(l, "multiplicación") * num(r, "multiplicación");
    case "/": return num(l, "división") / num(r, "división");
    case "%": {
      const a = num(l, "módulo"), b = num(r, "módulo");
      return a - Math.floor(a / b) * b;
    }
    case "^": return Math.pow(num(l, "potencia"), num(r, "potencia"));
    case "..": return tostr(l) + tostr(r);
    case "==": return l === r;
    case "~=": return l !== r;
    case "<":
    case "<=":
    case ">":
    case ">=": {
      if (typeof l !== typeof r || (typeof l !== "number" && typeof l !== "string")) {
        throw new RuntimeError(`no se puede comparar ${typeName(l)} con ${typeName(r)}`);
      }
      const a = l as number | string, b = r as number | string;
      if (op === "<") return a < b;
      if (op === "<=") return a <= b;
      if (op === ">") return a > b;
      return a >= b;
    }
    default: throw new RuntimeError(`operador binario desconocido ${op}`);
  }
}

function unary(op: string, v: unknown): unknown {
  switch (op) {
    case "-": return -num(v, "negación");
    case "not": return !truthy(v);
    case "#":
      if (typeof v === "string") return v.length;
      throw new RuntimeError(`intento de obtener longitud de un valor de tipo ${typeName(v)}`);
    default: throw new RuntimeError(`operador unario desconocido ${op}`);
  }
}
