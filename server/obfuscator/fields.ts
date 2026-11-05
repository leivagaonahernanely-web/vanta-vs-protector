// Nombres de los campos del payload (P.protos, proto.code, ...). Cada compilación usa nombres
// aleatorios distintos, derivados de la semilla, así que el archivo no revela su estructura
// con palabras como "opnames" o "params". El runtime y el payload usan el mismo mapa.
export const PAYLOAD_FIELDS = [
  "protos", "consts", "names", "ops", "opnames", "k", "nconsts", "slots", "code", "params", "bp", "up", "ncs",
] as const;

export type FieldMap = Record<(typeof PAYLOAD_FIELDS)[number], string>;

const LUA_RESERVED = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function", "goto", "if", "in",
  "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while",
]);

// Generador determinista (mulberry32): misma semilla, mismos nombres.
function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fieldMap(seed: number): FieldMap {
  const rand = prng(seed ^ 0x5eed);
  const used = new Set<string>(LUA_RESERVED);
  const map = {} as FieldMap;
  for (const name of PAYLOAD_FIELDS) {
    let candidate: string;
    do {
      candidate = "_" + Math.floor(rand() * 36 ** 5).toString(36).padStart(5, "0");
    } while (used.has(candidate));
    used.add(candidate);
    map[name] = candidate;
  }
  return map;
}
