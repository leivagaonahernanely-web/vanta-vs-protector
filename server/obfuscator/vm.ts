// Codificador y ejecutor de bytecode. El codificador asigna a cada operación un número
// distinto según una semilla, así que cada script tiene su propia tabla de opcodes.
// Esta VM de referencia en TypeScript define la semántica que replicará el runtime en Lua.
import { OP_NAMES, type OpName, type Program, type UpvalDesc } from "./compiler";

export type Cell = { v: unknown };

export type BytecodeProto = {
  code: number[]; // pares [id de operación, argumento] ya ofuscados
  params: number;
  slots: number;
  upvals: UpvalDesc[];
};

export type Bytecode = {
  protos: BytecodeProto[];
  opTable: OpName[]; // id -> nombre; en el runtime real va cifrada
  consts: Program["consts"];
  names: string[];
  ops: string[];
};

export type Env = Record<string, unknown>;

export class RuntimeError extends Error {}

export class LuaTable {
  readonly hash = new Map<unknown, unknown>();
}

export class LuaFunction {
  readonly proto: BytecodeProto;
  readonly upvals: Cell[];
  constructor(proto: BytecodeProto, upvals: Cell[]) {
    this.proto = proto;
    this.upvals = upvals;
  }
}

const DEFAULT_MAX_STEPS = 1_000_000;
const MAX_DEPTH = 1000;

// Generador pseudoaleatorio determinista (mulberry32): la misma semilla da el mismo mapa.
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
  const opTable: OpName[] = [...OP_NAMES];
  for (let i = opTable.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [opTable[i], opTable[j]] = [opTable[j], opTable[i]];
  }
  const idOf = new Map<OpName, number>(opTable.map((name, id) => [name, id]));

  const protos = program.protos.map((p) => {
    const code: number[] = [];
    for (const instr of p.code) {
      code.push(idOf.get(instr.op)!, instr.a ?? 0);
    }
    return { code, params: p.params, slots: p.slots, upvals: p.upvals };
  });
  return { protos, opTable, consts: program.consts, names: program.names, ops: program.ops };
}

type Ctx = { steps: number; maxSteps: number; env: Env; depth: number };

export function execute(bc: Bytecode, env: Env, maxSteps = DEFAULT_MAX_STEPS): unknown {
  const ctx: Ctx = { steps: 0, maxSteps, env, depth: 0 };
  return runFunction(bc, new LuaFunction(bc.protos[0], []), [], ctx);
}

function runFunction(bc: Bytecode, fn: LuaFunction, args: unknown[], ctx: Ctx): unknown {
  const proto = fn.proto;
  if (++ctx.depth > MAX_DEPTH) throw new RuntimeError("desbordamiento de la pila de llamadas");
  try {
    const cells: Cell[] = [];
    for (let i = 0; i < proto.slots; i++) cells.push({ v: null });
    for (let i = 0; i < proto.params; i++) cells[i] = { v: args[i] ?? null };

    const stack: unknown[] = [];
    const push = (v: unknown) => { stack.push(v); };
    const pop = (): unknown => {
      if (stack.length === 0) throw new RuntimeError("pila vacía");
      return stack.pop();
    };

    let pc = 0;
    while (true) {
      if (++ctx.steps > ctx.maxSteps) throw new RuntimeError("límite de ejecución superado");
      const id = proto.code[pc * 2];
      const a = proto.code[pc * 2 + 1];
      pc++;
      const op = bc.opTable[id];

      switch (op) {
        case "CONST": push(bc.consts[a]); break;
        case "LOCAL_GET": push(cells[a].v); break;
        case "LOCAL_SET": cells[a].v = pop(); break;
        case "DECL": cells[a] = { v: pop() }; break;
        case "GLOBAL_GET": push(ctx.env[bc.names[a]] ?? null); break;
        case "GLOBAL_SET": ctx.env[bc.names[a]] = pop(); break;
        case "UP_GET": push(fn.upvals[a].v); break;
        case "UP_SET": fn.upvals[a].v = pop(); break;
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
        case "SWAP": { const b = pop(); const c = pop(); push(b); push(c); break; }
        case "CALL": {
          const callArgs: unknown[] = [];
          for (let i = 0; i < a; i++) callArgs.unshift(pop());
          const callee = pop();
          push(call(bc, callee, callArgs, ctx));
          break;
        }
        case "RET": return pop();
        case "CLOSURE": {
          const child = bc.protos[a];
          const ups = child.upvals.map((d) => (d.fromLocal ? cells[d.index] : fn.upvals[d.index]));
          push(new LuaFunction(child, ups));
          break;
        }
        case "NEWTABLE": push(new LuaTable()); break;
        case "INDEX": {
          const key = pop();
          const obj = pop();
          push(index(ctx, obj, key));
          break;
        }
        case "SETINDEX": {
          const value = pop();
          const key = pop();
          const obj = pop();
          setIndex(obj, key, value);
          break;
        }
        default: throw new RuntimeError(`operación desconocida ${id}`);
      }
    }
  } finally {
    ctx.depth--;
  }
}

function call(bc: Bytecode, callee: unknown, args: unknown[], ctx: Ctx): unknown {
  if (callee instanceof LuaFunction) {
    const result = runFunction(bc, callee, args, ctx);
    return result === undefined ? null : result;
  }
  if (typeof callee === "function") {
    const result = callee(...args);
    return result === undefined ? null : result;
  }
  throw new RuntimeError(`se intentó llamar a un valor de tipo ${typeName(callee)}`);
}

function index(ctx: Ctx, obj: unknown, key: unknown): unknown {
  if (obj instanceof LuaTable) {
    const v = obj.hash.get(key);
    return v === undefined ? null : v;
  }
  if (typeof obj === "string") {
    // Los strings usan la tabla "string" como metatabla, como en Lua.
    const lib = ctx.env.string;
    if (lib instanceof LuaTable) return index(ctx, lib, key);
    return null;
  }
  throw new RuntimeError(`intento de indexar un valor de tipo ${typeName(obj)}`);
}

function setIndex(obj: unknown, key: unknown, value: unknown) {
  if (!(obj instanceof LuaTable)) throw new RuntimeError(`intento de asignar a un valor de tipo ${typeName(obj)}`);
  if (key === null || key === undefined) throw new RuntimeError("índice nil");
  if (typeof key === "number" && Number.isNaN(key)) throw new RuntimeError("índice NaN");
  if (value === null || value === undefined) obj.hash.delete(key);
  else obj.hash.set(key, value);
}

export function truthy(v: unknown): boolean {
  return v !== null && v !== undefined && v !== false;
}

function typeName(v: unknown): string {
  if (v === null || v === undefined) return "nil";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return "number";
  if (typeof v === "string") return "string";
  if (v instanceof LuaTable) return "table";
  return "function";
}

// Convierte a texto como print/tostring de Lua 5.1 (números con %.14g).
export function tostr(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") {
    if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
    return String(Number(v.toPrecision(14)));
  }
  if (v === null || v === undefined) return "nil";
  if (typeof v === "boolean") return String(v);
  if (v instanceof LuaTable) return "table";
  return "function";
}

// Lua solo concatena strings y números; cualquier otro tipo es error.
function concatPart(v: unknown): string {
  if (typeof v === "string" || typeof v === "number") return tostr(v);
  throw new RuntimeError(`intento de concatenar un valor de tipo ${typeName(v)}`);
}

function num(v: unknown, what: string): number {
  if (typeof v === "number") return v;
  throw new RuntimeError(`intento de ${what} sobre un valor de tipo ${typeName(v)}`);
}

function binary(op: string, l: unknown, r: unknown): unknown {
  switch (op) {
    case "+": return num(l, "sumar") + num(r, "sumar");
    case "-": return num(l, "restar") - num(r, "restar");
    case "*": return num(l, "multiplicar") * num(r, "multiplicar");
    case "/": return num(l, "dividir") / num(r, "dividir");
    case "%": {
      const a = num(l, "calcular módulo"), b = num(r, "calcular módulo");
      return a - Math.floor(a / b) * b;
    }
    case "^": return Math.pow(num(l, "elevar"), num(r, "elevar"));
    case "..": return concatPart(l) + concatPart(r);
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
    case "-": return -num(v, "negar");
    case "not": return !truthy(v);
    case "#":
      if (typeof v === "string") return v.length;
      if (v instanceof LuaTable) {
        let n = 0;
        while (v.hash.has(n + 1)) n++;
        return n;
      }
      throw new RuntimeError(`intento de obtener longitud de un valor de tipo ${typeName(v)}`);
    default: throw new RuntimeError(`operador unario desconocido ${op}`);
  }
}
