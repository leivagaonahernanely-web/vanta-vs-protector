// Compilador AST -> bytecode de máquina de pila con prototipos por función.
// Cada variable local vive en una celda, así las funciones internas capturan referencias
// correctas (closures). Soporta: locales, globales, upvalues, aritmética, comparaciones,
// concatenación, and/or/not, tablas, indexación, llamadas y métodos (a:b()), funciones,
// if/while/repeat/for numérico, break y return de un valor.
// No soporta todavía: varargs, for genérico y retornos múltiples.
import type { Block, Expr, Stmt } from "./parser";

export const OP_NAMES = [
  "CONST", "LOCAL_GET", "LOCAL_SET", "DECL", "GLOBAL_GET", "GLOBAL_SET", "UP_GET", "UP_SET",
  "BIN", "UN", "JMP", "JMPF", "JMPT", "DUP", "POP", "SWAP", "CALL", "RET", "CLOSURE",
  "NEWTABLE", "INDEX", "SETINDEX",
] as const;
export type OpName = (typeof OP_NAMES)[number];

export type Const = number | string | boolean | null;

export type Instr = { op: OpName; a?: number };

export type UpvalDesc = { fromLocal: boolean; index: number };

export type Proto = {
  code: Instr[];
  params: number;
  slots: number;
  upvals: UpvalDesc[];
};

export type Program = {
  protos: Proto[]; // protos[0] es el fragmento principal
  consts: Const[];
  names: string[];
  ops: string[]; // operadores binarios y unarios usados
};

export class CompileError extends Error {
  readonly line?: number;
  constructor(message: string, line?: number) {
    super(line ? `línea ${line}: ${message}` : message);
    this.name = "CompileError";
    this.line = line;
  }
}

type FnState = {
  code: Instr[];
  scopes: Map<string, number>[];
  slots: number;
  loops: number[][];
  upvals: UpvalDesc[];
  upvalNames: Map<string, number>;
};

type Ref = { kind: "local" | "up" | "global"; a: number };

export function compile(block: Block): Program {
  return new Compiler().compileMain(block);
}

const NEG_ZERO_KEY = Symbol("-0");

class Compiler {
  private consts: Const[] = [];
  private names: string[] = [];
  private ops: string[] = [];
  private constMap = new Map<unknown, number>();
  private nameMap = new Map<string, number>();
  private opMap = new Map<string, number>();
  private protos: Proto[] = [];
  private fns: FnState[] = [];

  compileMain(block: Block): Program {
    this.functionProto([], block, false);
    return { protos: this.protos, consts: this.consts, names: this.names, ops: this.ops };
  }

  private get fn(): FnState { return this.fns[this.fns.length - 1]; }

  private emit(op: OpName, a?: number): number {
    const instr: Instr = a === undefined ? { op } : { op, a };
    this.fn.code.push(instr);
    return this.fn.code.length - 1;
  }

  private here(): number { return this.fn.code.length; }

  private patch(at: number, target: number) {
    this.fn.code[at].a = target;
  }

  // Compila una función y devuelve el índice de su prototipo.
  private functionProto(params: string[], body: Block, isVararg: boolean, line?: number): number {
    if (isVararg) throw new CompileError("varargs (...) todavía no soportados", line);
    const index = this.protos.length;
    this.protos.push(null as unknown as Proto); // reserva el índice antes de compilar anidadas
    this.fns.push({ code: [], scopes: [new Map()], slots: 0, loops: [], upvals: [], upvalNames: new Map() });
    for (const p of params) this.declareLocal(p);
    this.block(body, false);
    this.emit("CONST", this.constIndex(null));
    this.emit("RET");
    const state = this.fns.pop()!;
    this.protos[index] = { code: state.code, params: params.length, slots: state.slots, upvals: state.upvals };
    return index;
  }

  // Búsquedas en O(1) con Map: antes eran indexOf/findIndex lineales, cuadráticas en scripts grandes.
  // Map compara con SameValueZero, que trata +0 y -0 como iguales; Object.is (la semántica original)
  // no. Por eso -0 usa una clave reservada.
  private constIndex(value: Const): number {
    const key: unknown = Object.is(value, -0) ? NEG_ZERO_KEY : value;
    const known = this.constMap.get(key);
    if (known !== undefined) return known;
    this.consts.push(value);
    this.constMap.set(key, this.consts.length - 1);
    return this.consts.length - 1;
  }

  private nameIndex(name: string): number {
    const known = this.nameMap.get(name);
    if (known !== undefined) return known;
    this.names.push(name);
    this.nameMap.set(name, this.names.length - 1);
    return this.names.length - 1;
  }

  private opIndex(op: string): number {
    const known = this.opMap.get(op);
    if (known !== undefined) return known;
    this.ops.push(op);
    this.opMap.set(op, this.ops.length - 1);
    return this.ops.length - 1;
  }

  private findLocal(st: FnState, name: string): number | undefined {
    for (let i = st.scopes.length - 1; i >= 0; i--) {
      const slot = st.scopes[i].get(name);
      if (slot !== undefined) return slot;
    }
    return undefined;
  }

  // Devuelve el índice de upvalue de `name` en el nivel `level`, o -1 si es global.
  private upvalIndex(level: number, name: string): number {
    const st = this.fns[level];
    const known = st.upvalNames.get(name);
    if (known !== undefined) return known;
    if (level === 0) return -1;
    const parent = this.fns[level - 1];
    const local = this.findLocal(parent, name);
    let desc: UpvalDesc;
    if (local !== undefined) {
      desc = { fromLocal: true, index: local };
    } else {
      const outer = this.upvalIndex(level - 1, name);
      if (outer < 0) return -1;
      desc = { fromLocal: false, index: outer };
    }
    st.upvals.push(desc);
    const idx = st.upvals.length - 1;
    st.upvalNames.set(name, idx);
    return idx;
  }

  private lookup(name: string): Ref {
    const top = this.fns.length - 1;
    const slot = this.findLocal(this.fn, name);
    if (slot !== undefined) return { kind: "local", a: slot };
    const up = this.upvalIndex(top, name);
    if (up >= 0) return { kind: "up", a: up };
    return { kind: "global", a: this.nameIndex(name) };
  }

  private declareLocal(name: string): number {
    const slot = this.fn.slots++;
    this.fn.scopes[this.fn.scopes.length - 1].set(name, slot);
    return slot;
  }

  private newTemp(): number { return this.fn.slots++; }

  private block(stmts: Block, newScope = true) {
    if (newScope) this.fn.scopes.push(new Map());
    for (const s of stmts) this.statement(s);
    if (newScope) this.fn.scopes.pop();
  }

  private storeName(name: string) {
    const ref = this.lookup(name);
    if (ref.kind === "local") this.emit("LOCAL_SET", ref.a);
    else if (ref.kind === "up") this.emit("UP_SET", ref.a);
    else this.emit("GLOBAL_SET", ref.a);
  }

  private statement(s: Stmt) {
    switch (s.kind) {
      case "Local": {
        this.pushValues(s.values, s.names.length);
        const slots = s.names.map((n) => this.declareLocal(n));
        for (let i = slots.length - 1; i >= 0; i--) this.emit("DECL", slots[i]);
        return;
      }
      case "LocalFunction": {
        // Se declara antes de compilar el cuerpo para que la función pueda llamarse a sí misma.
        const slot = this.declareLocal(s.name);
        this.emit("CONST", this.constIndex(null));
        this.emit("DECL", slot);
        const proto = this.functionProto(s.fn.params, s.fn.body, s.fn.isVararg, s.line);
        this.emit("CLOSURE", proto);
        this.emit("LOCAL_SET", slot);
        return;
      }
      case "FunctionDecl": {
        if (s.target.kind === "Name") {
          const proto = this.functionProto(s.fn.params, s.fn.body, s.fn.isVararg, s.line);
          this.emit("CLOSURE", proto);
          this.storeName(s.target.name);
          return;
        }
        if (s.target.kind === "Index") {
          this.expr(s.target.object);
          this.expr(s.target.key);
          const proto = this.functionProto(s.fn.params, s.fn.body, s.fn.isVararg, s.line);
          this.emit("CLOSURE", proto);
          this.emit("SETINDEX");
          return;
        }
        throw new CompileError("declaración de función no válida", s.line);
      }
      case "Assign": {
        // Primero se evalúan los objetos y claves de los destinos, luego los valores.
        const prepared: { obj?: number; key?: number }[] = s.targets.map((t) => {
          if (t.kind === "Name") return {};
          if (t.kind !== "Index") throw new CompileError("no se puede asignar a esta expresión", s.line);
          this.expr(t.object);
          const obj = this.newTemp();
          this.emit("DECL", obj);
          this.expr(t.key);
          const key = this.newTemp();
          this.emit("DECL", key);
          return { obj, key };
        });
        this.pushValues(s.values, s.targets.length);
        for (let i = s.targets.length - 1; i >= 0; i--) {
          const t = s.targets[i];
          const p = prepared[i];
          if (t.kind === "Name") { this.storeName(t.name); continue; }
          // El valor queda en la cima: lo guardamos y luego llamamos a SETINDEX con [obj, clave, valor].
          const val = this.newTemp();
          this.emit("DECL", val);
          this.emit("LOCAL_GET", p.obj!);
          this.emit("LOCAL_GET", p.key!);
          this.emit("LOCAL_GET", val);
          this.emit("SETINDEX");
        }
        return;
      }
      case "CallStmt":
        this.expr(s.call);
        this.emit("POP");
        return;
      case "Do":
        this.block(s.body);
        return;
      case "While": {
        const start = this.here();
        this.expr(s.cond);
        const exit = this.emit("JMPF", -1);
        this.fn.loops.push([]);
        this.block(s.body);
        this.emit("JMP", start);
        this.finishLoop(exit);
        return;
      }
      case "Repeat": {
        // El cuerpo y la condición comparten ámbito, como en Lua.
        const start = this.here();
        this.fn.scopes.push(new Map());
        this.fn.loops.push([]);
        for (const st of s.body) this.statement(st);
        this.expr(s.cond);
        this.emit("JMPF", start);
        this.fn.scopes.pop();
        const breaks = this.fn.loops.pop()!;
        for (const b of breaks) this.patch(b, this.here());
        return;
      }
      case "If": {
        const endJumps: number[] = [];
        for (const clause of s.clauses) {
          this.expr(clause.cond);
          const skip = this.emit("JMPF", -1);
          this.block(clause.body);
          endJumps.push(this.emit("JMP", -1));
          this.patch(skip, this.here());
        }
        if (s.orElse) this.block(s.orElse);
        for (const j of endJumps) this.patch(j, this.here());
        return;
      }
      case "NumericFor": {
        const step = s.step;
        const negative = step?.kind === "Unary" && step.op === "-" && step.operand.kind === "Number";
        if (step && !(step.kind === "Number" || negative)) {
          throw new CompileError("el paso del for debe ser una constante numérica", s.line);
        }
        this.fn.scopes.push(new Map());
        this.expr(s.start);
        const iSlot = this.newTemp();
        this.emit("DECL", iSlot);
        this.expr(s.limit);
        const limSlot = this.newTemp();
        this.emit("DECL", limSlot);
        this.emit("CONST", this.constIndex(step ? this.numericValue(step) : 1));
        const stepSlot = this.newTemp();
        this.emit("DECL", stepSlot);
        const start = this.here();
        this.emit("LOCAL_GET", iSlot);
        this.emit("LOCAL_GET", limSlot);
        this.emit("BIN", this.opIndex(negative ? ">=" : "<="));
        const exit = this.emit("JMPF", -1);
        this.fn.loops.push([]);
        this.fn.scopes.push(new Map());
        // La variable de control es nueva en cada vuelta (importa para closures).
        const varSlot = this.declareLocal(s.name);
        this.emit("LOCAL_GET", iSlot);
        this.emit("DECL", varSlot);
        this.block(s.body, false);
        this.fn.scopes.pop();
        this.emit("LOCAL_GET", iSlot);
        this.emit("LOCAL_GET", stepSlot);
        this.emit("BIN", this.opIndex("+"));
        this.emit("LOCAL_SET", iSlot);
        this.emit("JMP", start);
        this.finishLoop(exit);
        this.fn.scopes.pop();
        return;
      }
      case "GenericFor":
        throw new CompileError("for genérico todavía no soportado (requiere retornos múltiples)", s.line);
      case "Return":
        if (s.values.length > 1) throw new CompileError("solo se soporta un valor de retorno por ahora", s.line);
        if (s.values.length === 0) this.emit("CONST", this.constIndex(null));
        else this.expr(s.values[0]);
        this.emit("RET");
        return;
      case "Break": {
        const loop = this.fn.loops[this.fn.loops.length - 1];
        if (!loop) throw new CompileError("'break' fuera de un bucle", s.line);
        loop.push(this.emit("JMP", -1));
        return;
      }
    }
  }

  private finishLoop(exit: number) {
    this.patch(exit, this.here());
    const breaks = this.fn.loops.pop()!;
    for (const b of breaks) this.patch(b, this.here());
  }

  private numericValue(e: Expr): number {
    if (e.kind === "Number") return e.value;
    if (e.kind === "Unary" && e.op === "-" && e.operand.kind === "Number") return -e.operand.value;
    throw new CompileError("se esperaba una constante numérica");
  }

  // Empuja exactamente `count` valores, rellenando con nil o descartando sobrantes.
  private pushValues(values: Expr[], count: number) {
    values.forEach((v, i) => {
      this.expr(v);
      if (i >= count) this.emit("POP");
    });
    for (let i = values.length; i < count; i++) this.emit("CONST", this.constIndex(null));
  }

  private expr(e: Expr) {
    switch (e.kind) {
      case "Nil": this.emit("CONST", this.constIndex(null)); return;
      case "True": this.emit("CONST", this.constIndex(true)); return;
      case "False": this.emit("CONST", this.constIndex(false)); return;
      case "Number":
      case "String":
        this.emit("CONST", this.constIndex(e.value));
        return;
      case "Vararg":
        throw new CompileError("varargs (...) todavía no soportados");
      case "Name": {
        const ref = this.lookup(e.name);
        if (ref.kind === "local") this.emit("LOCAL_GET", ref.a);
        else if (ref.kind === "up") this.emit("UP_GET", ref.a);
        else this.emit("GLOBAL_GET", ref.a);
        return;
      }
      case "Index":
        this.expr(e.object);
        this.expr(e.key);
        this.emit("INDEX");
        return;
      case "Paren":
        this.expr(e.expr);
        return;
      case "Unary":
        this.expr(e.operand);
        this.emit("UN", this.opIndex(e.op));
        return;
      case "Binary":
        if (e.op === "and" || e.op === "or") {
          // Cortocircuito: si el izquierdo decide, se queda en la pila.
          this.expr(e.left);
          this.emit("DUP");
          const jump = this.emit(e.op === "and" ? "JMPF" : "JMPT", -1);
          this.emit("POP");
          this.expr(e.right);
          this.patch(jump, this.here());
          return;
        }
        this.expr(e.left);
        this.expr(e.right);
        this.emit("BIN", this.opIndex(e.op));
        return;
      case "Call":
        this.expr(e.callee);
        for (const a of e.args) this.expr(a);
        this.emit("CALL", e.args.length);
        return;
      case "MethodCall":
        // obj:m(args) == obj.m(obj, args)
        this.expr(e.object);
        this.emit("DUP");
        this.emit("CONST", this.constIndex(e.method));
        this.emit("INDEX");
        this.emit("SWAP");
        for (const a of e.args) this.expr(a);
        this.emit("CALL", e.args.length + 1);
        return;
      case "Function": {
        const proto = this.functionProto(e.params, e.body, e.isVararg, e.line);
        this.emit("CLOSURE", proto);
        return;
      }
      case "Table": {
        this.emit("NEWTABLE");
        let position = 1;
        for (const item of e.items) {
          this.emit("DUP");
          if (item.kind === "Positional") {
            this.emit("CONST", this.constIndex(position++));
            this.expr(item.value);
          } else if (item.kind === "Named") {
            this.emit("CONST", this.constIndex(item.key));
            this.expr(item.value);
          } else {
            this.expr(item.key);
            this.expr(item.value);
          }
          this.emit("SETINDEX");
        }
        return;
      }
    }
    throw new CompileError(`expresión no soportada: ${(e as { kind: string }).kind}`);
  }
}
