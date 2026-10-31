import { describe, expect, it } from "vitest";
import { stripComments } from "./comments";

describe("quitar comentarios de código Lua", () => {
  it("quita comentarios de línea y conserva el salto", () => {
    expect(stripComments("x = 1 -- hola\ny = 2")).toBe("x = 1 \ny = 2");
  });

  it("no toca el contenido de cadenas cortas", () => {
    expect(stripComments('s = "a -- b" -- c')).toBe('s = "a -- b" ');
    expect(stripComments("s = 'it\\'s -- x' -- y")).toBe("s = 'it\\'s -- x' ");
  });

  it("quita comentarios largos y conserva sus saltos de línea", () => {
    expect(stripComments("a --[[ x\ny ]] b")).toBe("a \n b");
    expect(stripComments("--[==[ x ]==] z")).toBe(" z");
  });

  it("no confunde cadenas largas con comentarios", () => {
    expect(stripComments("s = [[--no es comentario]] -- sí")).toBe("s = [[--no es comentario]] ");
  });

  it("elimina el texto del comentario", () => {
    expect(stripComments("--desdén blah blah blah")).toBe("");
  });
});
