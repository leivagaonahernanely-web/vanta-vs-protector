import { describe, expect, it } from "vitest";
import { parse, type Expr, type Stmt } from "./parser";
import { LuaSyntaxError } from "./lexer";

// Expresión de una sentencia "return <expr>" para inspeccionar el árbol.
const ret = (src: string): Expr => {
  const block = parse(`return ${src}`);
  return (block[0] as Extract<Stmt, { kind: "Return" }>).values[0];
};

describe("parser Lua 5.1", () => {
  it("respeta la precedencia de operadores", () => {
    // 1 + 2 * 3 debe ser 1 + (2 * 3)
    expect(ret("1 + 2 * 3")).toMatchObject({
      kind: "Binary", op: "+", left: { kind: "Number", value: 1 },
      right: { kind: "Binary", op: "*" },
    });
  });

  it("hace que ^ sea más fuerte que el menos unario", () => {
    // -x^2 es -(x^2)
    expect(ret("-x^2")).toMatchObject({ kind: "Unary", op: "-", operand: { kind: "Binary", op: "^" } });
  });

  it("asocia .. y ^ por la derecha", () => {
    expect(ret("a .. b .. c")).toMatchObject({ kind: "Binary", op: "..", right: { kind: "Binary", op: ".." } });
    expect(ret("a ^ b ^ c")).toMatchObject({ kind: "Binary", op: "^", right: { kind: "Binary", op: "^" } });
  });

  it("asocia - por la izquierda", () => {
    expect(ret("a - b - c")).toMatchObject({ kind: "Binary", op: "-", left: { kind: "Binary", op: "-" } });
  });

  it("parsea llamadas encadenadas, índices y métodos", () => {
    expect(ret('a.b["c"]:d(1, "x"){}')).toMatchObject({
      kind: "Call",
      callee: { kind: "MethodCall", method: "d" },
    });
  });

  it("convierte a.b en índice con clave de cadena", () => {
    expect(ret("a.b")).toEqual({
      kind: "Index",
      object: { kind: "Name", name: "a", line: 1 },
      key: { kind: "String", value: "b" },
    });
  });

  it("parsea constructores de tabla mixtos", () => {
    const t = ret("{1, x = 2, [3] = 4; 5}") as Extract<Expr, { kind: "Table" }>;
    expect(t.items.map((i) => i.kind)).toEqual(["Positional", "Named", "Keyed", "Positional"]);
  });

  it("añade self como primer parámetro en métodos", () => {
    const [decl] = parse("function obj.a.b:run(x) end") as Extract<Stmt, { kind: "FunctionDecl" }>[];
    expect(decl.isMethod).toBe(true);
    expect(decl.fn.params).toEqual(["self", "x"]);
  });

  it("reconoce funciones con varargs", () => {
    const [decl] = parse("local function f(a, ...) return ... end") as Stmt[];
    expect(decl).toMatchObject({ kind: "LocalFunction", name: "f", fn: { params: ["a"], isVararg: true } });
  });

  it("parsea if / elseif / else", () => {
    const [stmt] = parse("if a then x() elseif b then y() else z() end") as Stmt[];
    expect(stmt).toMatchObject({ kind: "If", clauses: [{}, {}], orElse: [{ kind: "CallStmt" }] });
  });

  it("parsea for numérico y genérico", () => {
    const [numeric, generic] = parse("for i = 1, 10, 2 do end for k, v in pairs(t) do end") as Stmt[];
    expect(numeric).toMatchObject({ kind: "NumericFor", name: "i", step: { kind: "Number", value: 2 } });
    expect(generic).toMatchObject({ kind: "GenericFor", names: ["k", "v"] });
  });

  it("parsea repeat-until y while", () => {
    const [rep, wh] = parse("repeat x = x + 1 until x > 3 while true do break end") as Stmt[];
    expect(rep.kind).toBe("Repeat");
    expect(wh).toMatchObject({ kind: "While", body: [{ kind: "Break" }] });
  });

  it("parsea asignaciones múltiples y local con varios nombres", () => {
    const [local, assign] = parse("local a, b = 1 a, b.c = 2, 3") as Stmt[];
    expect(local).toMatchObject({ kind: "Local", names: ["a", "b"] });
    expect(assign).toMatchObject({ kind: "Assign", targets: [{ kind: "Name" }, { kind: "Index" }] });
  });

  it("acepta punto y coma vacío", () => {
    expect(parse(";;x = 1;")).toHaveLength(1);
  });

  it("exige que return sea la última sentencia", () => {
    expect(() => parse("return 1 x = 2")).toThrow(/última sentencia/);
  });

  it("rechaza expresiones sin efecto", () => {
    expect(() => parse("x")).toThrow(/expresión sin efecto/);
  });

  it("indica qué se esperaba al fallar", () => {
    expect(() => parse("if x then y()")).toThrow(/se esperaba 'end'/);
    expect(() => parse("local = 1")).toThrow(LuaSyntaxError);
  });
});
