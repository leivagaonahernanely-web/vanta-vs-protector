// Compilador AST -> bytecode de máquina de pila.
// Subconjunto actual: variables locales y globales, aritmética, comparaciones, concatenación,
// and/or/not, if/while/for numérico/do/break/return, y llamadas a funciones nativas.
// Tablas, funciones de usuario, varargs y retornos múltiples se rechazan explícitamente.
import type { Block, Expr, Stmt } from "./parser";

export type Instr =
  | { op: "CONST"; a: number }   // empuja consts[a]
  | { op: "LOCAL_GET"; a: number }
  | { op: "LOCAL_SET"; a: number } // saca de la pila y guarda
  | { op: "GLOBAL_GET"; a: number } // a = índice en names
  | { op: "GLOBAL_SET"; a: number }
  | { op: "BIN"; a: number }     // a = índice en ops binarios
  | { op: "UN"; a: number }      // a = índice en ops unarios
  | { op: "JMP"; a: number }
  | { op: "JMPF"; a: number }    // salta si el tope es falso y lo saca
  | { op: "JMPT"; a: number }    // salta si el tope es verdadero y lo saca
  | { op: "DUP" }
  | { op: "POP" }
  | { op: "CALL"; a: number }    // a = número de argumentos; la función va debajo de ellos
  | { op: "RET" };               // devuelve el tope

export type Program = {
  code: Instr[];
  consts: (number | string | boolean | null)[];
  names: string[];
  ops: string[]; // operadores binarios y unarios usados
  slots: number;
};

export class CompileError extends Error {
  readonly line?: number;
  constructor(message: string, line?: number) {
    super(line ? `línea ${line}: ${message}` : message);
    this.name = "CompileError";
    this.line = line;
  }
}

const UNSUPPORTED: Record<string, string> = {
  Vararg: "varargs (...) todavía no soportados",
  Table: "tablas todavía no soportadas",
  Function: "funciones de usuario todavía no soportadas",
  Index: "acceso a campos (a.b / a[b]) todavía no soportado",
  MethodCall: "llamadas con dos puntos (obj:m()) todavía no soportadas",
};

export function compile(block: Block): Program {
  return new Compiler().compileChunk(block);
}

class Compiler {
  private code: Instr[] = [];
  private consts: Program["consts"] = [];
  private names: string[] = [];
  private ops: string[] = [];
  private scopes: Map<string, number>[] = [new Map()];
  private slots = 0;
  private loops: number[][] = []; // listas de saltos pendientes de cada bucle

  compileChunk(block: Block): Program {
    this.block(block, false);
    this.code.push({ op: "CONST", a: this.constIndex(null) }, { op: "RET" });
    return { code: this.code, consts: this.consts, names: this.names, ops: this.ops, slots: this.slots };
  }

  private emit(instr: Instr): number {
    this.code.push(instr);
    return this.code.length - 1;
  }

  private patch(at: number, target: number) {
    const instr = this.code[at];
    if (instr.op !== "JMP" && instr.op !== "JMPF" && instr.op !== "JMPT") throw new Error("parche sobre instrucción no-salto");
    instr.a = target;
  }

  private here() { return this.code.length; }

  private constIndex(value: Program["consts"][number]): number {
    const i = this.consts.findIndex((c) => Object.is(c, value));
    if (i !== -1) return i;
    this.consts.push(value);
    return this.consts.length - 1;
  }

  private nameIndex(name: string): number {
    let i = this.names.indexOf(name);
    if (i === -1) { this.names.push(name); i = this.names.length - 1; }
    return i;
  }

  private opIndex(op: string): number {
    let i = this.ops.indexOf(op);
    if (i === -1) { this.ops.push(op); i = this.ops.length - 1; }
    return i;
  }

  private resolveLocal(name: string): number | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const slot = this.scopes[i].get(name);
      if (slot !== undefined) return slot;
    }
    return undefined;
  }

  private declareLocal(name: string): number {
    const slot = this.slots++;
    this.scopes[this.scopes.length - 1].set(name, slot);
    return slot;
  }

  private newSlot(): number { return this.slots++; }

  private block(stmts: Block, newScope = true) {
    if (newScope) this.scopes.push(new Map());
    for (const s of stmts) this.statement(s);
    if (newScope) this.scopes.pop();
  }

  private statement(s: Stmt) {
    switch (s.kind) {
      case "Local": {
        // Evalúa todos los valores antes de declarar, como en Lua.
        this.pushValues(s.values, s.names.length, s.line);
        const slots = s.names.map((n) => this.declareLocal(n));
        for (let i = slots.length - 1; i >= 0; i--) this.emit({ op: "LOCAL_SET", a: slots[i] });
        return;
      }
      case "Assign": {
        this.pushValues(s.values, s.targets.length, s.line);
        for (let i = s.targets.length - 1; i >= 0; i--) {
          const t = s.targets[i];
          if (t.kind !== "Name") throw new CompileError(UNSUPPORTED.Index, s.line);
          const slot = this.resolveLocal(t.name);
          if (slot !== undefined) this.emit({ op: "LOCAL_SET", a: slot });
          else this.emit({ op: "GLOBAL_SET", a: this.nameIndex(t.name) });
        }
        return;
      }
      case "CallStmt":
        this.expr(s.call);
        this.emit({ op: "POP" });
        return;
      case "Do":
        this.block(s.body);
        return;
      case "While": {
        const start = this.here();
        this.expr(s.cond);
        const exit = this.emit({ op: "JMPF", a: -1 });
        this.loops.push([]);
        this.block(s.body);
        this.emit({ op: "JMP", a: start });
        this.finishLoop(exit);
        return;
      }
      case "Repeat": {
        // El cuerpo y la condición comparten ámbito, como en Lua.
        const start = this.here();
        this.scopes.push(new Map());
        this.loops.push([]);
        for (const st of s.body) this.statement(st);
        this.expr(s.cond);
        this.emit({ op: "JMPF", a: start });
        this.scopes.pop();
        const breaks = this.loops.pop()!;
        for (const b of breaks) this.patch(b, this.here());
        return;
      }
      case "If": {
        const endJumps: number[] = [];
        for (const clause of s.clauses) {
          this.expr(clause.cond);
          const skip = this.emit({ op: "JMPF", a: -1 });
          this.block(clause.body);
          endJumps.push(this.emit({ op: "JMP", a: -1 }));
          this.patch(skip, this.here());
        }
        if (s.orElse) this.block(s.orElse);
        for (const j of endJumps) this.patch(j, this.here());
        return;
      }
      case "NumericFor": {
        const step = s.step;
        const negative = step?.kind === "Unary" && step.op === "-" && step.operand.kind === "Number";
        if (step && !(step.kind === "Number" || negative)) throw new CompileError("el paso del for debe ser una constante numérica", s.line);
        this.scopes.push(new Map());
        this.expr(s.start);
        const iSlot = this.newSlot();
        this.emit({ op: "LOCAL_SET", a: iSlot });
        this.expr(s.limit);
        const limSlot = this.newSlot();
        this.emit({ op: "LOCAL_SET", a: limSlot });
        this.emit({ op: "CONST", a: this.constIndex(step ? this.numericValue(step) : 1) });
        const stepSlot = this.newSlot();
        this.emit({ op: "LOCAL_SET", a: stepSlot });
        const start = this.here();
        this.emit({ op: "LOCAL_GET", a: iSlot });
        this.emit({ op: "LOCAL_GET", a: limSlot });
        this.emit({ op: "BIN", a: this.opIndex(negative ? ">=" : "<=") });
        const exit = this.emit({ op: "JMPF", a: -1 });
        this.loops.push([]);
        this.scopes.push(new Map());
        const varSlot = this.declareLocal(s.name);
        this.emit({ op: "LOCAL_GET", a: iSlot });
        this.emit({ op: "LOCAL_SET", a: varSlot });
        this.block(s.body, false);
        this.scopes.pop();
        this.emit({ op: "LOCAL_GET", a: iSlot });
        this.emit({ op: "LOCAL_GET", a: stepSlot });
        this.emit({ op: "BIN", a: this.opIndex("+") });
        this.emit({ op: "LOCAL_SET", a: iSlot });
        this.emit({ op: "JMP", a: start });
        this.finishLoop(exit);
        this.scopes.pop();
        return;
      }
      case "GenericFor":
        throw new CompileError("for genérico todavía no soportado (requiere tablas)", s.line);
      case "FunctionDecl":
      case "LocalFunction":
        throw new CompileError(UNSUPPORTED.Function, s.line);
      case "Return":
        if (s.values.length > 1) throw new CompileError("solo se soporta un valor de retorno por ahora", s.line);
        if (s.values.length === 0) this.emit({ op: "CONST", a: this.constIndex(null) });
        else this.expr(s.values[0]);
        this.emit({ op: "RET" });
        return;
      case "Break": {
        const loop = this.loops[this.loops.length - 1];
        if (!loop) throw new CompileError("'break' fuera de un bucle", s.line);
        loop.push(this.emit({ op: "JMP", a: -1 }));
        return;
      }
    }
  }

  // Cierra un bucle: parchea la salida y los break pendientes.
  private finishLoop(exit: number) {
    this.patch(exit, this.here());
    const breaks = this.loops.pop()!;
    for (const b of breaks) this.patch(b, this.here());
  }

  private numericValue(e: Expr): number {
    if (e.kind === "Number") return e.value;
    if (e.kind === "Unary" && e.op === "-" && e.operand.kind === "Number") return -e.operand.value;
    throw new CompileError("se esperaba una constante numérica");
  }

  // Empuja exactamente `count` valores, rellenando con nil o descartando sobrantes.
  private pushValues(values: Expr[], count: number, line: number) {
    if (values.length > count) {
      // Evalúa los extra y los descarta.
      values.forEach((v, i) => { this.expr(v); if (i >= count) this.emit({ op: "POP" }); });
      return;
    }
    values.forEach((v) => this.expr(v));
    for (let i = values.length; i < count; i++) this.emit({ op: "CONST", a: this.constIndex(null) });
    void line;
  }

  private expr(e: Expr) {
    if (e.kind in UNSUPPORTED) throw new CompileError(UNSUPPORTED[e.kind]);
    switch (e.kind) {
      case "Nil": this.emit({ op: "CONST", a: this.constIndex(null) }); return;
      case "True": this.emit({ op: "CONST", a: this.constIndex(true) }); return;
      case "False": this.emit({ op: "CONST", a: this.constIndex(false) }); return;
      case "Number":
      case "String":
        this.emit({ op: "CONST", a: this.constIndex(e.value) });
        return;
      case "Name": {
        const slot = this.resolveLocal(e.name);
        if (slot !== undefined) this.emit({ op: "LOCAL_GET", a: slot });
        else this.emit({ op: "GLOBAL_GET", a: this.nameIndex(e.name) });
        return;
      }
      case "Paren":
        this.expr(e.expr);
        return;
      case "Unary":
        this.expr(e.operand);
        this.emit({ op: "UN", a: this.opIndex(e.op) });
        return;
      case "Binary":
        if (e.op === "and" || e.op === "or") {
          // Cortocircuito: si el izquierdo decide, se queda en la pila.
          this.expr(e.left);
          this.emit({ op: "DUP" });
          const jump = this.emit({ op: e.op === "and" ? "JMPF" : "JMPT", a: -1 });
          this.emit({ op: "POP" });
          this.expr(e.right);
          this.patch(jump, this.here());
          return;
        }
        this.expr(e.left);
        this.expr(e.right);
        this.emit({ op: "BIN", a: this.opIndex(e.op) });
        return;
      case "Call":
        this.expr(e.callee);
        for (const a of e.args) this.expr(a);
        this.emit({ op: "CALL", a: e.args.length });
        return;
    }
    throw new CompileError(`expresión no soportada: ${(e as { kind: string }).kind}`);
  }
}
