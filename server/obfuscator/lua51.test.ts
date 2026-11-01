import { describe, expect, it } from "vitest";
import { buildLua } from "./build";
import { tokenize } from "./lexer";

// Operadores que existen en Lua 5.1 (lo que ejecutan los executors y Roblox). Cualquier otro
// operador en la salida significa sintaxis de Lua 5.2+ o de Luau que no corre en 5.1.
const LUA51_OPS = new Set([
  "...", "..", "==", "~=", "<=", ">=", "+", "-", "*", "/", "%", "^", "#", "<", ">", "=",
  "(", ")", "{", "}", "[", "]", ";", ":", ",", ".",
]);

describe("salida compatible con Lua 5.1", () => {
  it("usa solo operadores de Lua 5.1 y ningún nombre reservado de 5.2+", () => {
    const src = "local t = {1, 2, 3} local s = 0 for _, v in ipairs(t) do s = s + v end print(s)";
    const { code } = buildLua(src, 3);
    for (const tok of tokenize(code)) {
      if (tok.type === "op") expect(LUA51_OPS.has(String(tok.value))).toBe(true);
      if (tok.type === "tstring") throw new Error("backticks en la salida");
      if (tok.type === "name") expect(tok.value).not.toBe("goto");
    }
  });
});
