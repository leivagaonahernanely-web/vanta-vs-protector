// Cifrado de cadenas del payload. El runtime tiene el descifrado equivalente (decstr).
// Cifrado con retroalimentación: c[i] = (p[i] + clave[i mod n] + c[i-1] + salt) mod 256, con c[0] = 0.
// A diferencia de un XOR repetido, cada byte depende del anterior, así que no hay patrón periódico.
export function encryptBytes(plain: Buffer, salt: number, key: number[]): Buffer {
  const out = Buffer.alloc(plain.length);
  let prev = 0;
  for (let i = 0; i < plain.length; i++) {
    out[i] = (plain[i] + key[i % key.length] + prev + salt) % 256;
    prev = out[i];
  }
  return out;
}
