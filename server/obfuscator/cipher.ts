// Cifrado de cadenas del payload y de los mensajes del runtime. El runtime tiene el descifrado
// equivalente en Lua (ks_init / ks_next / decstr en runtime.ts): cualquier cambio aquí debe
// reflejarse allí.
//
// Flujo tipo RC4 con solo suma mod 256 (sin XOR, porque Lua 5.1 y Luau no lo tienen de serie):
// - KSA: la permutación S de 256 bytes se mezcla con la clave de la compilación y con el salt
//   de la cadena, así cada cadena usa un flujo distinto.
// - Cada byte cifrado es (texto + flujo) mod 256. Después el byte cifrado se suma al índice j
//   del flujo, así que el flujo depende de todo lo cifrado antes. Con un cifrado lineal, un
//   solo texto plano conocido bastaba para recuperar la clave; aquí no.
// Limitación: la clave viaja en el archivo de salida, así que esto sube el costo de revertirlo;
// no es un secreto frente a quien lea el runtime.

export type Keystream = { S: number[]; i: number; j: number };

export function keystreamInit(key: number[], salt: number): Keystream {
  const kb = [
    ...key,
    salt % 256,
    Math.floor(salt / 256) % 256,
    Math.floor(salt / 65536) % 256,
    Math.floor(salt / 16777216) % 256,
  ];
  const S = Array.from({ length: 256 }, (_, t) => t);
  let j = 0;
  for (let t = 0; t < 256; t++) {
    j = (j + S[t] + kb[t % kb.length]) % 256;
    [S[t], S[j]] = [S[j], S[t]];
  }
  return { S, i: 0, j: 0 };
}

function nextKeyByte(st: Keystream): number {
  st.i = (st.i + 1) % 256;
  st.j = (st.j + st.S[st.i]) % 256;
  [st.S[st.i], st.S[st.j]] = [st.S[st.j], st.S[st.i]];
  return st.S[(st.S[st.i] + st.S[st.j]) % 256];
}

export function encryptBytes(plain: Buffer, salt: number, key: number[]): Buffer {
  const st = keystreamInit(key, salt);
  const out = Buffer.alloc(plain.length);
  for (let n = 0; n < plain.length; n++) {
    const c = (plain[n] + nextKeyByte(st)) % 256;
    out[n] = c;
    st.j = (st.j + c) % 256; // retroalimentación con el byte cifrado
  }
  return out;
}

// Inverso de encryptBytes (lo usa el runtime en Lua; aquí sirve para pruebas).
export function decryptBytes(cipher: Buffer, salt: number, key: number[]): Buffer {
  const st = keystreamInit(key, salt);
  const out = Buffer.alloc(cipher.length);
  for (let n = 0; n < cipher.length; n++) {
    const c = cipher[n];
    out[n] = (((c - nextKeyByte(st)) % 256) + 256) % 256;
    st.j = (st.j + c) % 256;
  }
  return out;
}

// Cifra la lista de operandos de un prototipo (pares id/argumento). Cada valor de 32 bits se
// suma a una palabra del flujo, módulo 2^32. Así no se ve el bytecode en claro en el archivo.
// Valores admitidos: enteros de 32 bits con signo.
export function encryptWords(values: number[], salt: number, key: number[]): number[] {
  const st = keystreamInit(key, salt);
  const M = 4294967296;
  return values.map((v) => {
    if (!Number.isInteger(v) || v < -2147483648 || v > 2147483647) {
      throw new Error(`operando fuera de rango de 32 bits: ${v}`);
    }
    const b1 = nextKeyByte(st);
    const b2 = nextKeyByte(st);
    const b3 = nextKeyByte(st);
    const b4 = nextKeyByte(st);
    const k = b1 + 256 * b2 + 65536 * b3 + 16777216 * b4;
    return (((v % M) + M) + k) % M;
  });
}
