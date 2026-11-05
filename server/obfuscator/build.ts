// Construcción del archivo de salida con macros de optimización y protección.
//
// Reglas:
// - Sin macros, el obfuscador decide: bucles, funciones y callbacks van nativos y el resto en la VM.
// - Bloque "--NXT_LPH_OPTIMIZACION" ... "--NXT_LPH_OPTIMIZACION_END": se emite como Lua nativo (sin lag).
// - Bloque "--NXT_LPH_PROTECCION" ... "--NXT_LPH_PROTECCION_END": si el archivo tiene alguno,
//   solo esos bloques van en la VM y el resto queda nativo.
// - Los macros deben estar a nivel principal y no pueden anidarse.
// - Un bloque nativo y uno protegido no pueden compartir variables "local" a nivel principal
//   (cada uno vive en un contexto distinto). Las globales sí se comparten.
import { compile } from "./compiler";
import { stripComments } from "./comments";
import { payloadLiteral } from "./emit";
import { LuaSyntaxError } from "./lexer";
import { PRELUDE_LUA } from "./prelude";
import { kindsFor, runtimeLua } from "./runtime";
import { fieldMap } from "./fields";
import { minifyLua, oneLine } from "./minify";
import { parse } from "./parser";
import type { Block, Expr, Stmt } from "./parser";
import { encode } from "./vm";
import { NativePrinter } from "./printer";
import { tokenize } from "./lexer";
import { injectDeadCode } from "./deadcode";

// Nombres declarados en un segmento y referenciados en otro.
function sharedTopLevelNames(info: { declared: Set<string>; referenced: Set<string> }[]): Set<string> {
  const shared = new Set<string>();
  info.forEach((own, i) => {
    own.declared.forEach((name) => {
      info.forEach((other, j) => {
        if (i !== j && other.referenced.has(name)) shared.add(name);
      });
    });
  });
  return shared;
}

// Convierte en asignaciones a globales las declaraciones locales de nivel principal cuyos
// nombres están en `names`.
function localsToGlobals(block: Block, names: Set<string>): Block {
  return block.map((s) => {
    if (s.kind === "Local" && s.names.some((n) => names.has(n))) {
      const targets = s.names.map((n) => ({ kind: "Name", name: n, line: s.line }));
      const values = s.values.length ? s.values : [{ kind: "Nil", line: s.line }];
      return { kind: "Assign", targets, values, line: s.line } as unknown as Stmt;
    }
    if (s.kind === "LocalFunction" && names.has(s.name)) {
      const target = { kind: "Name", name: s.name, line: s.line };
      return { kind: "Assign", targets: [target], values: [s.fn], line: s.line } as unknown as Stmt;
    }
    return s;
  });
}

export class BuildError extends Error {
  readonly line?: number;
  constructor(message: string, line?: number) {
    super(line ? `línea ${line}: ${message}` : message);
    this.name = "BuildError";
    this.line = line;
  }
}

const OPT_START = /^\s*--\s*NXT_LPH_OPTIMIZACION\s*$/;
const OPT_END = /^\s*--\s*NXT_LPH_OPTIMIZACION_END\s*$/;
const PROT_START = /^\s*--\s*NXT_LPH_PROTECCION\s*$/;
const PROT_END = /^\s*--\s*NXT_LPH_PROTECCION_END\s*$/;

export type Segment = { kind: "native" | "protected"; source: string; line: number };

// Divide el código en segmentos según los macros. `line` es la primera línea del segmento (1-based).
export function splitSegments(source: string): Segment[] {
  const lines = source.split(/\r\n|\n|\r/);
  const hasProtection = lines.some((l) => PROT_START.test(l));

  type State = "none" | "opt" | "prot";
  let state: State = "none";
  let openedAt = 0;
  const kinds: ("native" | "protected" | null)[] = [];

  lines.forEach((line, i) => {
    const lineNo = i + 1;
    if (OPT_START.test(line) || PROT_START.test(line)) {
      if (state !== "none") throw new BuildError("los macros no se pueden anidar", lineNo);
      state = OPT_START.test(line) ? "opt" : "prot";
      openedAt = lineNo;
      kinds.push(null);
      return;
    }
    if (OPT_END.test(line) || PROT_END.test(line)) {
      const expected = OPT_END.test(line) ? "opt" : "prot";
      if (state !== expected) throw new BuildError("cierre de macro sin apertura correspondiente", lineNo);
      state = "none";
      kinds.push(null);
      return;
    }
    if (state === "opt") kinds.push("native");
    else if (state === "prot") kinds.push("protected");
    else kinds.push(hasProtection ? "native" : "protected");
  });
  if (state !== "none") throw new BuildError("macro sin cerrar", openedAt);

  // Agrupa líneas consecutivas del mismo tipo; los marcadores (null) cortan el grupo.
  const segments: Segment[] = [];
  let current: { kind: "native" | "protected"; start: number; lines: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const text = current.lines.join("\n");
    if (text.trim().length > 0) segments.push({ kind: current.kind, source: text, line: current.start });
    current = null;
  };
  kinds.forEach((kind, i) => {
    if (kind === null) { flush(); return; }
    if (!current || current.kind !== kind) {
      flush();
      current = { kind, start: i + 1, lines: [] };
    }
    current.lines.push(lines[i]);
  });
  flush();
  return segments;
}

// Nombres declarados como locales a nivel principal y nombres referenciados en un bloque.
export function namesOf(block: Block): { declared: Set<string>; referenced: Set<string> } {
  const declared = new Set<string>();
  const referenced = new Set<string>();
  for (const s of block) {
    if (s.kind === "Local") s.names.forEach((n) => declared.add(n));
    if (s.kind === "LocalFunction") declared.add(s.name);
  }
  const visitExpr = (e: Expr): void => {
    switch (e.kind) {
      case "Name": referenced.add(e.name); return;
      case "Index": visitExpr(e.object); visitExpr(e.key); return;
      case "Call": visitExpr(e.callee); e.args.forEach(visitExpr); return;
      case "MethodCall": visitExpr(e.object); e.args.forEach(visitExpr); return;
      case "Function": visitBlock(e.body); return;
      case "Table":
        for (const item of e.items) {
          if (item.kind === "Keyed") { visitExpr(item.key); visitExpr(item.value); }
          else visitExpr(item.value);
        }
        return;
      case "Binary": visitExpr(e.left); visitExpr(e.right); return;
      case "Unary": visitExpr(e.operand); return;
      case "Paren": visitExpr(e.expr); return;
      case "IfExpr":
        for (const c of e.clauses) { visitExpr(c.cond); visitExpr(c.value); }
        visitExpr(e.orElse);
        return;
      default: return;
    }
  };
  const visitStmt = (s: Stmt): void => {
    switch (s.kind) {
      case "Local": s.values.forEach(visitExpr); return;
      case "LocalFunction": visitExpr(s.fn); return;
      case "FunctionDecl": visitExpr(s.target); visitExpr(s.fn); return;
      case "Assign": s.targets.forEach(visitExpr); s.values.forEach(visitExpr); return;
      case "CallStmt": visitExpr(s.call); return;
      case "Do": visitBlock(s.body); return;
      case "While": visitExpr(s.cond); visitBlock(s.body); return;
      case "Repeat": visitBlock(s.body); visitExpr(s.cond); return;
      case "If":
        for (const c of s.clauses) { visitExpr(c.cond); visitBlock(c.body); }
        if (s.orElse) visitBlock(s.orElse);
        return;
      case "NumericFor":
        visitExpr(s.start); visitExpr(s.limit); if (s.step) visitExpr(s.step); visitBlock(s.body);
        return;
      case "GenericFor": s.iterators.forEach(visitExpr); visitBlock(s.body); return;
      case "Return": s.values.forEach(visitExpr); return;
      default: return;
    }
  };
  const visitBlock = (b: Block) => b.forEach(visitStmt);
  visitBlock(block);
  return { declared, referenced };
}

export type Built = { code: string; segments: number };

const ANY_MACRO = /^\s*--\s*NXT_LPH_(OPTIMIZACION|PROTECCION)(_END)?\s*$/;

// Sentencias que pueden ir nativas: bucles, funciones y cualquier sentencia con una función
// literal dentro (callbacks). El resto va en la VM.
function isNativeCandidate(s: Stmt): boolean {
  if (s.kind === "Return") return false;
  if (["NumericFor", "GenericFor", "While", "Repeat", "FunctionDecl", "LocalFunction"].includes(s.kind)) return true;
  return JSON.stringify(s).includes('"kind":"Function"');
}

// Reparto automático (sin macros). Las sentencias que empiezan en la misma línea forman una unidad.
// Una unidad nativa no puede compartir locales de nivel principal con una protegida: si lo hace,
// o si dos unidades que comparten locales quedarían en bloques distintos, se vuelve protegida.
export function autoSegments(source: string): Segment[] {
  const lines = source.split(/\r\n|\n|\r/);
  let block: Block;
  try {
    block = parse(source);
  } catch (error) {
    if (error instanceof LuaSyntaxError) throw new BuildError(error.message.replace(/^\d+:\d+: /, ""), error.line);
    throw error;
  }

  type Unit = { line: number; stmts: Stmt[]; native: boolean; declared: Set<string>; referenced: Set<string> };
  const units: Unit[] = [];
  for (const s of block) {
    const line = (s as { line?: number }).line ?? 1;
    const last = units[units.length - 1];
    if (last && last.line === line) last.stmts.push(s);
    else units.push({ line, stmts: [s], native: false, declared: new Set(), referenced: new Set() });
  }
  for (const u of units) {
    const info = namesOf(u.stmts);
    u.declared = info.declared;
    u.referenced = info.referenced;
    u.native = u.stmts.every(isNativeCandidate);
  }

  const shares = (a: Set<string>, b: Set<string>) => {
    for (const n of a) if (b.has(n)) return true;
    return false;
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (let j = 0; j < units.length; j++) {
      for (let k = j + 1; k < units.length; k++) {
        const a = units[j];
        const b = units[k];
        if (!shares(a.declared, b.referenced) && !shares(b.declared, a.referenced)) continue;
        const flags = units.slice(j, k + 1).map((u) => u.native);
        if (flags.every((f) => f === flags[0])) continue; // todas nativas o todas protegidas: mismo bloque
        for (let m = j; m <= k; m++) {
          if (units[m].native) { units[m].native = false; changed = true; }
        }
      }
    }
  }

  // Bloques consecutivos del mismo tipo. El primero empieza en la línea 1 para conservar comentarios de cabecera.
  const segments: Segment[] = [];
  let i = 0;
  while (i < units.length) {
    const kind = units[i].native ? "native" : "protected";
    let k = i;
    while (k + 1 < units.length && (units[k + 1].native ? "native" : "protected") === kind) k++;
    const startLine = i === 0 ? 1 : units[i].line;
    const endLine = k + 1 < units.length ? units[k + 1].line - 1 : lines.length;
    segments.push({ kind, source: lines.slice(startLine - 1, endLine).join("\n"), line: startLine });
    i = k + 1;
  }
  return segments;
}

// Quita comentarios, sangría y líneas vacías. Solo se usa en el prelude y el runtime, que no tienen cadenas largas.
function compactLua(src: string): string {
  return stripComments(src)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .join("\n");
}

// Construye el archivo Lua final a partir del código fuente.
// Con macros, el reparto lo marca el usuario; sin macros, lo decide autoSegments.
export type BuildOptions = {
  printResult?: boolean;
  // Probabilidad (0 a 1) de insertar una rama muerta antes de cada sentencia protegida.
  deadCodeRate?: number;
  // Sin macros: si es true, los bucles y callbacks se dejan nativos (más rápido, menos protegido).
  autoNative?: boolean;
  // Número de pasadas: la salida de una pasada se vuelve a ofuscar. Por defecto, 1.
  passes?: number;
};

export function buildLua(source: string, seed: number, options: BuildOptions = {}): Built {
  const passes = Math.max(1, Math.floor(options.passes ?? 1));
  let current = buildOnce(source, seed, options);
  for (let p = 1; p < passes; p++) {
    // La pasada siguiente no vuelve a imprimir el resultado; usa otra semilla derivada.
    current = buildOnce(current.code, seed + 7919 * p, { ...options, printResult: false });
  }
  return current;
}

function buildOnce(source: string, seed: number, options: BuildOptions): Built {
  const deadCodeRate = options.deadCodeRate ?? 0.5;
  const hasMacros = source.split(/\r\n|\n|\r/).some((l) => ANY_MACRO.test(l));
  // Sin macros, todo va protegido en la VM. Con autoNative, los bucles y callbacks van nativos
  // (más rápido, menos protegido). Con macros, el reparto lo marca el usuario.
  const segments: Segment[] = hasMacros
    ? splitSegments(source)
    : options.autoNative
      ? autoSegments(source)
      : [{ kind: "protected", source, line: 1 }];
  if (segments.length === 0) throw new BuildError("el script está vacío");

  const parsed = segments.map((seg) => {
    try {
      return parse(seg.source);
    } catch (error) {
      if (error instanceof LuaSyntaxError) {
        const detail = error.message.replace(/^\d+:\d+: /, "");
        // Un segmento que no compila suele ser un macro dentro de una función o bloque.
        const hint = hasMacros ? " (los macros NXT_LPH_* deben ir a nivel principal, no dentro de una función o bloque)" : "";
        throw new BuildError(detail + hint, seg.line + error.line - 1);
      }
      throw error;
    }
  });

  // Una variable local de nivel principal declarada en un segmento y usada en otro pasa a ser
  // global (así un bloque de optimización puede definir funciones que usa el bloque protegido).
  const shared = sharedTopLevelNames(parsed.map(namesOf));
  if (shared.size > 0) {
    parsed.forEach((block, i) => {
      parsed[i] = localsToGlobals(block, shared);
    });
  }

  // Variables locales de nivel principal no pueden cruzar entre segmentos.
  const info = parsed.map(namesOf);
  info.forEach((own, i) => {
    own.declared.forEach((name) => {
      info.forEach((other, j) => {
        if (i !== j && other.referenced.has(name)) {
          throw new BuildError(
            `la variable local '${name}' se declara en un bloque y se usa fuera de él; usa un nombre distinto o hazla global`,
            segments[j].line,
          );
        }
      });
    });
  });

  const fields = fieldMap(seed);
  const kinds = kindsFor(seed);
  const chunks: string[] = [];
  segments.forEach((seg, i) => {
    const last = i === segments.length - 1;
    if (seg.kind === "native") {
      // Se escribe de nuevo con variables renombradas (alcance correcto); sin comentarios.
      const avoid = new Set(tokenize(seg.source).filter((t) => t.type === "name").map((t) => String(t.value)));
      chunks.push(`do\n${new NativePrinter(avoid).print(parsed[i])}\nend`);
      return;
    }
    let program;
    try {
      program = compile(injectDeadCode(parsed[i], seed + i, deadCodeRate));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BuildError(message.replace(/^línea \d+: /, ""), seg.line + ((error as { line?: number }).line ?? 1) - 1);
    }
    const bytecode = encode(program, seed + i);
    const run = last && options.printResult ? "print(nx_run(P))" : last ? "return nx_run(P)" : "nx_run(P)";
    chunks.push(`do local P=${payloadLiteral(bytecode, fields, kinds)} ${run} end`);
  });

  return {
    // Cabecera exacta; prelude y runtime sin comentarios, sangría ni líneas vacías (no tienen cadenas largas).
    code: `--Protect by NextOfuscator\n${oneLine(`${minifyLua(compactLua(PRELUDE_LUA))}\n${minifyLua(compactLua(runtimeLua(fields, kinds)))}\n${chunks.join("\n")}`)}\n`,
    segments: segments.length,
  };
}
