// Genera el archivo Lua de salida: runtime de la VM + bytecode cifrado como literal de tabla.
import { RUNTIME_LUA } from "./runtime";
import type { Bytecode } from "./vm";

export type EmitOptions = {
  // Si es true, el script devuelve el resultado; si no, lo imprime (usado en pruebas).
  printResult?: boolean;
  maxSteps?: number;
};

// Literal de cadena Lua con escapes decimales sobre los bytes UTF-8, válido en Lua 5.1.
export function luaString(s: string): string {
  let out = '"';
  for (const byte of Buffer.from(s, "utf8")) {
    if (byte === 34 || byte === 92) out += "\\" + String.fromCharCode(byte);
    else if (byte >= 32 && byte < 127) out += String.fromCharCode(byte);
    else out += "\\" + String(byte).padStart(3, "0");
  }
  return out + '"';
}

function luaNumber(n: number): string {
  if (Number.isNaN(n)) return "(0/0)";
  if (n === Infinity) return "(1/0)";
  if (n === -Infinity) return "(-1/0)";
  return String(n);
}

function luaValue(v: unknown): string {
  if (v === null || v === undefined) return "nil";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return luaNumber(v);
  if (typeof v === "string") return luaString(v);
  throw new Error("constante no serializable");
}

function luaList(items: string[]): string {
  return "{" + items.join(",") + "}";
}

export function emitLua(bc: Bytecode, options: EmitOptions = {}): string {
  const protos = bc.protos.map((p) =>
    `{code=${luaList(p.code.map(String))},params=${p.params},slots=${p.slots},` +
    `up=${luaList(p.upvals.map((u) => `{${u.fromLocal ? 1 : 0},${u.index}}`))}}`,
  );
  const payload =
    `local P={` +
    `opnames=${luaList(bc.opTable.map(luaString))},` +
    `consts=${luaList(bc.consts.map(luaValue))},` +
    `names=${luaList(bc.names.map(luaString))},` +
    `ops=${luaList(bc.ops.map(luaString))},` +
    `protos=${luaList(protos)}` +
    (options.maxSteps ? `,max_steps=${options.maxSteps}` : "") +
    `}`;
  const run = options.printResult ? "print(nx_run(P))" : "return nx_run(P)";
  return `-- NextOfuscator\n${RUNTIME_LUA}\n${payload}\n${run}\n`;
}
