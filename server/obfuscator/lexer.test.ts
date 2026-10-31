import { describe, expect, it } from "vitest";
import { LuaSyntaxError, tokenize } from "./lexer";

const values = (src: string) => tokenize(src).map((t) => t.value);

describe("lexer Lua 5.1", () => {
  it("reconoce palabras clave, nombres y operadores", () => {
    const tokens = tokenize("local a = b .. c ... ~= d");
    expect(tokens.map((t) => t.type)).toEqual([
      "keyword", "name", "op", "name", "op", "name", "op", "op", "name", "eof",
    ]);
    expect(values("local a = b .. c ... ~= d")).toEqual([
      "local", "a", "=", "b", "..", "c", "...", "~=", "d", "<eof>",
    ]);
  });

  it("convierte números decimales, con exponente y hexadecimales", () => {
    expect(values("3 3.5 .5 1e3 2.5E-2 0xFF")).toEqual([3, 3.5, 0.5, 1000, 0.025, 255, "<eof>"]);
  });

  it("rechaza números mal formados", () => {
    expect(() => tokenize("3x")).toThrow(LuaSyntaxError);
    expect(() => tokenize("1e")).toThrow(LuaSyntaxError);
    expect(() => tokenize("0x")).toThrow(LuaSyntaxError);
  });

  it("decodifica escapes de cadenas simples y dobles", () => {
    expect(values(String.raw`"a\nb" 'c\'d' "\65\066\0"`)).toEqual(["a\nb", "c'd", "AB\0", "<eof>"]);
    expect(values(String.raw`"\\\"\t"`)).toEqual(['\\"\t', "<eof>"]);
  });

  it("rechaza cadenas sin cerrar y escapes inválidos", () => {
    expect(() => tokenize('"abc')).toThrow(/cadena sin cerrar/);
    expect(() => tokenize('"abc\n"')).toThrow(/cadena sin cerrar/);
    expect(() => tokenize(String.raw`"\q"`)).toThrow(/escape inválido/);
    expect(() => tokenize(String.raw`"\300"`)).toThrow(/fuera de rango/);
  });

  it("lee cadenas largas y descarta el salto inicial", () => {
    expect(values("[[\nhola]]")).toEqual(["hola", "<eof>"]);
    expect(values("[==[a]]b]==]")).toEqual(["a]]b", "<eof>"]);
  });

  it("ignora comentarios de línea y de bloque", () => {
    expect(values("a -- comentario\nb")).toEqual(["a", "b", "<eof>"]);
    expect(values("a --[[ bloque\nmultilínea ]] b")).toEqual(["a", "b", "<eof>"]);
    expect(values("a --[==[ x ]] ]==] b")).toEqual(["a", "b", "<eof>"]);
  });

  it("cuenta líneas con \\n, \\r\\n y \\r sin duplicar", () => {
    const tokens = tokenize("a\r\nb\nc\rd");
    expect(tokens.map((t) => t.line)).toEqual([1, 2, 3, 4, 4]);
  });

  it("indica línea y columna del error", () => {
    try {
      tokenize("local x = 1\nlocal y = @");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(LuaSyntaxError);
      expect((error as LuaSyntaxError).line).toBe(2);
      expect((error as LuaSyntaxError).col).toBe(11);
    }
  });

  it("devuelve siempre un token eof al final", () => {
    expect(tokenize("").map((t) => t.type)).toEqual(["eof"]);
  });
});
