// Genera el archivo Lua de salida: runtime de la VM + bytecode como literal de tabla.
// Las cadenas (nombres de opcodes, operadores, globales y constantes de texto) van cifradas:
// cada byte se suma a una clave y a un salt por lista y posición, módulo 256. El runtime las
// descifra al cargar. OJO: la clave viaja en el mismo archivo, así que esto oculta las cadenas
// de un vistazo (grep, strings) pero no es un secreto frente a quien lea el runtime.
import { createHash } from "node:crypto";
import { kindsFor, runtimeLua, type Kinds } from "./runtime";
import { encryptBytes } from "./cipher";
import { fieldMap, type FieldMap } from "./fields";
import type { Bytecode } from "./vm";

export type EmitOptions = {
  // Si es true, el script devuelve el resultado; si no, lo imprime (usado en pruebas).
  printResult?: boolean;
};

// Salts base por lista. Deben coincidir con decstr() en runtime.ts.
export const SALT = { ops: 1_000_000, names: 2_000_000, consts: 3_000_000, opnames: 4_000_000 } as const;

const KEY_LENGTH = 16;

// Clave por compilación: depende del mapa de opcodes, que cambia con la semilla.
export function deriveKey(bc: Bytecode): number[] {
  const digest = createHash("sha256").update(bc.opTable.join(",")).digest();
  return [...digest.subarray(0, KEY_LENGTH)];
}


// Bytes arbitrarios como cadena base64 (el runtime la decodifica al cargar).
function luaBytes(bytes: Buffer): string {
  return `"${bytes.toString("base64")}"`;
}
// Mezcla determinista (Fisher-Yates con un generador congruencial), según la semilla.
function shuffleInPlace<T>(items: T[], seed: number): void {
  let s = seed >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

// Número entero como literal hexadecimal (0x..), válido en Lua 5.1 y Luau.
const H = (n: number): string => (Number.isInteger(n) ? (n < 0 ? "-" : "") + "0x" + Math.abs(n).toString(16) : String(n));

export function luaString(s: string): string {
  return luaBytes(Buffer.from(s, "latin1"));
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
  throw new Error("constante no serializable");
}

// Números finitos: se guardan como texto cifrado. Infinitos y NaN siguen como literal.
function isEncodableNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function luaList(items: string[]): string {
  return "{" + items.join(",") + "}";
}

// Suma ponderada del bytecode, igual que la que recalcula el runtime (índices base 1 y módulo
// que mantiene el resultado en [0, 2^31-1), como el % de Lua).
const CK_MOD = 2147483647;
export function bytecodeChecksum(protos: { code: number[] }[]): number {
  let ck = 0;
  for (const p of protos) {
    for (let j = 0; j < p.code.length; j++) {
      const v = ck * 31 + p.code[j] + (j + 1);
      ck = ((v % CK_MOD) + CK_MOD) % CK_MOD;
    }
  }
  return ck;
}

// Literal de tabla Lua con el bytecode de un programa, listo para nx_run.
export function payloadLiteral(bc: Bytecode, fields: FieldMap = fieldMap(0), kinds: Kinds = kindsFor(0)): string {
  // Clave aleatoria por compilación (de la semilla), no derivada de nombres públicos.
  const key = kinds.msgKey;
  const f = fields;
  // Índices base 1, igual que en Lua: el salt de cada cadena es base + índice.
  const enc = (s: string, base: number, i: number) =>
    luaBytes(encryptBytes(Buffer.from(s, "latin1"), base + i + 1, key));

  const protos = bc.protos.map((p) =>
    `{${f.code}=${luaList(p.code.map(H))},${f.params}=${H(p.params)},${f.slots}=${H(p.slots)},` +
    `${f.up}=${luaList(p.upvals.map((u) => `{${u.fromLocal ? 1 : 0},${H(u.index)}}`))},` +
    `${f.bp}=${luaList(p.boxedParams.map(H))}}`,
  );
  // Cada campo es una entrada con nombre: el orden en la tabla no importa para Lua, así que
  // se mezcla según la semilla y dos salidas no tienen el mismo orden de campos.
  const parts: string[] = [
    `${f.k}=${luaList(key.map(H))}`,
    // Tipos de instrucción como números (sin cifrar): el runtime los compara con sus propios números.
    `${f.opnames}=${luaList(bc.opTable.map((s) => H(kinds.ops[s])))}`,
    `${f.nconsts}=${H(bc.consts.length)}`,
    // Solo las cadenas van cifradas; el runtime distingue cadenas por tipo.
    `${f.consts}=${luaList(bc.consts.map((v, i) => (typeof v === "string" || isEncodableNumber(v) ? enc(String(v), SALT.consts, i) : luaValue(v))))}`,
    `${f.ncs}=${luaList(bc.consts.flatMap((v, i) => (isEncodableNumber(v) ? [H(i + 1)] : [])))}`,
    `${f.names}=${luaList(bc.names.map((s, i) => enc(s, SALT.names, i)))}`,
    `${f.ops}=${luaList(bc.ops.map((s, i) => enc(s, SALT.ops, i)))}`,
    `${f.protos}=${luaList(protos)}`,
    `${f.ck}=${H(bytecodeChecksum(bc.protos))}`,
  ];
  shuffleInPlace(parts, key.reduce((acc, b) => (acc * 31 + b) >>> 0, 7));
  return `{${parts.join(",")}}`;
}

export function emitLua(bc: Bytecode, options: EmitOptions = {}): string {
  const run = options.printResult ? "print(nx_run(P))" : "return nx_run(P)";
  const fields = fieldMap(0);
  const kinds = kindsFor(0);
  return `-- NextOfuscator\n${runtimeLua(fields, kinds)}\nlocal P=${payloadLiteral(bc, fields, kinds)}\n${run}\n`;
}
