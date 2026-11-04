// Escribe un bloque nativo (bucles, funciones, callbacks) de nuevo como Lua/Luau, renombrando
// las variables locales con alcance correcto. Las globales, campos (x.nombre, x:nombre, { nombre = })
// y nombres reservados no se tocan. Los nombres nuevos evitan todos los identificadores del
// fragmento, así que nunca chocan con una global ni con un campo.
import type { Block, Expr, Stmt } from "./parser";

const LUA_KEYWORDS = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function", "goto", "if", "in",
  "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while", "continue",
]);

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function luaStringLiteral(bytes: string): string {
  // `bytes` es una cadena de bytes (un carácter por byte).
  let out = '"';
  for (let i = 0; i < bytes.length; i++) {
    const code = bytes.charCodeAt(i);
    const ch = bytes[i];
    if (ch === '"' || ch === "\\") out += "\\" + ch;
    else if (code >= 32 && code < 127) out += ch;
    else out += "\\" + String(code).padStart(3, "0");
  }
  return out + '"';
}

class Namer {
  private counter = 0;
  private readonly avoid: Set<string>;
  constructor(avoid: Set<string>) {
    this.avoid = avoid;
  }
  next(): string {
    const alpha = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_";
    for (;;) {
      let n = this.counter++;
      let name = "";
      do {
        name = alpha[n % alpha.length] + name;
        n = Math.floor(n / alpha.length) - 1;
      } while (n >= 0);
      if (!this.avoid.has(name) && !LUA_KEYWORDS.has(name)) return name;
    }
  }
}

export class NativePrinter {
  private scopes: Map<string, string>[] = [new Map()];
  private namer: Namer;

  // `avoid`: todos los identificadores que aparecen en el fragmento original.
  constructor(avoid: Set<string>) {
    this.namer = new Namer(avoid);
  }

  print(block: Block): string {
    return this.block(block, false);
  }

  private open(): void {
    this.scopes.push(new Map());
  }
  private close(): void {
    this.scopes.pop();
  }
  private bind(name: string): string {
    const fresh = this.namer.next();
    this.scopes[this.scopes.length - 1].set(name, fresh);
    return fresh;
  }
  private resolve(name: string): string {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const hit = this.scopes[i].get(name);
      if (hit !== undefined) return hit;
    }
    return name;
  }

  // Bloque con su propio alcance (salvo `inScope`, que usa el alcance ya abierto).
  private block(stmts: Block, ownScope = true): string {
    if (ownScope) this.open();
    const text = stmts.map((s) => this.stmt(s)).join("\n");
    if (ownScope) this.close();
    return text;
  }

  private stmt(s: Stmt): string {
    switch (s.kind) {
      case "Local": {
        const values = s.values.map((e) => this.expr(e));
        const names = s.names.map((n) => this.bind(n));
        return `local ${names.join(", ")}${values.length ? " = " + values.join(", ") : ""}`;
      }
      case "Assign":
        return `${s.targets.map((e) => this.expr(e)).join(", ")} = ${s.values.map((e) => this.expr(e)).join(", ")}`;
      case "CallStmt":
        return this.expr(s.call);
      case "Do":
        return `do\n${this.block(s.body)}\nend`;
      case "While":
        return `while ${this.expr(s.cond)} do\n${this.block(s.body)}\nend`;
      case "Repeat": {
        this.open();
        const body = this.block(s.body, false);
        const cond = this.expr(s.cond);
        this.close();
        return `repeat\n${body}\nuntil ${cond}`;
      }
      case "If": {
        const parts = s.clauses.map((c, i) => `${i === 0 ? "if" : "elseif"} ${this.expr(c.cond)} then\n${this.block(c.body)}`);
        let text = parts.join("\n");
        if (s.orElse) text += `\nelse\n${this.block(s.orElse)}`;
        return text + "\nend";
      }
      case "NumericFor": {
        const head = `${this.expr(s.start)}, ${this.expr(s.limit)}${s.step ? ", " + this.expr(s.step) : ""}`;
        this.open();
        const name = this.bind(s.name);
        const body = this.block(s.body, false);
        this.close();
        return `for ${name} = ${head} do\n${body}\nend`;
      }
      case "GenericFor": {
        const iters = s.iterators.map((e) => this.expr(e)).join(", ");
        this.open();
        const names = s.names.map((n) => this.bind(n));
        const body = this.block(s.body, false);
        this.close();
        return `for ${names.join(", ")} in ${iters} do\n${body}\nend`;
      }
      case "FunctionDecl": {
        const target = this.expr(s.target);
        return `function ${target}${this.functionBody(s.fn)}`;
      }
      case "LocalFunction": {
        const name = this.bind(s.name);
        return `local function ${name}${this.functionBody(s.fn)}`;
      }
      case "Return":
        return `return${s.values.length ? " " + s.values.map((e) => this.expr(e)).join(", ") : ""}`;
      case "Break":
        return "break";
      case "Continue":
        return "continue";
    }
  }

  private functionBody(fn: Expr & { kind: "Function" }): string {
    this.open();
    const params = fn.params.map((p) => this.bind(p));
    if (fn.isVararg) params.push("...");
    const body = this.block(fn.body, false);
    this.close();
    return `(${params.join(", ")})\n${body}\nend`;
  }

  private expr(e: Expr): string {
    switch (e.kind) {
      case "Nil": return "nil";
      case "True": return "true";
      case "False": return "false";
      case "Vararg": return "...";
      case "Number":
        if (e.value === Infinity) return "(1/0)";
        if (e.value === -Infinity) return "(-1/0)";
        return String(e.value);
      case "String": return luaStringLiteral(e.value);
      case "Name": return this.resolve(e.name);
      case "Index": {
        const obj = this.wrapPrefix(e.object);
        if (e.key.kind === "String" && IDENT.test(e.key.value) && !LUA_KEYWORDS.has(e.key.value)) {
          return `${obj}.${e.key.value}`;
        }
        return `${obj}[${this.expr(e.key)}]`;
      }
      case "Call":
        return `${this.wrapPrefix(e.callee)}(${e.args.map((a) => this.expr(a)).join(", ")})`;
      case "MethodCall":
        return `${this.wrapPrefix(e.object)}:${e.method}(${e.args.map((a) => this.expr(a)).join(", ")})`;
      case "Function":
        return `function${this.functionBody(e)}`;
      case "Table": {
        const items = e.items.map((item) => {
          if (item.kind === "Positional") return this.expr(item.value);
          if (item.kind === "Named") return `${item.key} = ${this.expr(item.value)}`;
          return `[${this.expr(item.key)}] = ${this.expr(item.value)}`;
        });
        return `{${items.join(", ")}}`;
      }
      case "Binary":
        return `(${this.expr(e.left)} ${e.op} ${this.expr(e.right)})`;
      case "Unary":
        return e.op === "not" ? `(not ${this.expr(e.operand)})` : `(${e.op}${this.expr(e.operand)})`;
      case "Paren":
        return `(${this.expr(e.expr)})`;
      case "IfExpr": {
        const parts = e.clauses.map((c, i) => `${i === 0 ? "if" : "elseif"} ${this.expr(c.cond)} then ${this.expr(c.value)}`);
        return `(${parts.join(" ")} else ${this.expr(e.orElse)})`;
      }
    }
  }

  // Un prefijo (objeto o función llamada) necesita paréntesis si no es un nombre, índice, llamada o paréntesis.
  private wrapPrefix(e: Expr): string {
    const text = this.expr(e);
    return e.kind === "Name" || e.kind === "Index" || e.kind === "Call" || e.kind === "MethodCall" || e.kind === "Paren"
      ? text
      : `(${text})`;
  }
}
