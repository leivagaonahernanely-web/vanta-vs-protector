// Cifrado de cadenas del payload, con estado. Un generador congruencial (mod 65521) produce un byte
// de clave por posición; se siembra con la clave de la compilación y el salt de la cadena, así que
// no hay una tabla de bytes fija que se pueda restar. Cada byte cifrado también se suma al siguiente
// (retroalimentación sobre el texto cifrado). NXDEC_LUA es el descifrado equivalente para el runtime:
// si cambia un paso aquí, cambia también allí (lo cubren las pruebas de equivalencia).
const MOD = 65521;

function seedFor(salt: number, key: number[]): number {
  let s = 0;
  for (const b of key) s = (s * 31 + b) % MOD;
  return (s * 2654 + salt) % MOD;
}

export function encryptBytes(plain: Buffer, salt: number, key: number[]): Buffer {
  const out = Buffer.alloc(plain.length);
  let st = seedFor(salt, key);
  let prev = 0;
  for (let i = 0; i < plain.length; i++) {
    st = (st * 183 + 3688 + (i + 1)) % MOD; // índices base 1, como en Lua
    out[i] = (plain[i] + (st % 256) + prev) % 256;
    prev = out[i];
  }
  return out;
}

// Descifrado en Lua 5.1 / Luau. Requiere `b64dec` en el mismo ámbito y no usa cadenas literales
// (así el propio runtime no lo convierte en mensajes cifrados).
export const NXDEC_LUA = `local function nxdec(s, salt, key)
    s = b64dec(s)
    local st = 0
    for i = 1, #key do st = (st * 31 + key[i]) % 65521 end
    st = (st * 2654 + salt) % 65521
    local out, prev = {}, 0
    for i = 1, #s do
      st = (st * 183 + 3688 + i) % 65521
      local c = string.byte(s, i)
      out[i] = string.char((c - st % 256 - prev) % 256)
      prev = c
    end
    return table.concat(out)
  end`;
