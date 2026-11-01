// Uso: npx tsx scripts/ofuscar.ts entrada.lua [salida.lua] [semilla]
// Ofusca un archivo Lua con el mismo motor que la web, sin login ni API key.
import { readFileSync, writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import { BuildError, buildLua } from "../server/obfuscator/build";

const [input, output = "salida.lua", seedArg] = process.argv.slice(2);
if (!input) {
  console.error("Uso: npx tsx scripts/ofuscar.ts entrada.lua [salida.lua] [semilla]");
  process.exit(1);
}

try {
  const seed = seedArg ? Number(seedArg) : randomInt(1, 2 ** 31);
  const { code, segments } = buildLua(readFileSync(input, "utf8"), seed);
  writeFileSync(output, code, "utf8");
  console.log(`OK: ${output} (${segments} segmento(s), semilla ${seed})`);
} catch (error) {
  if (error instanceof BuildError) {
    console.error(`Error de sintaxis: ${error.message}`);
    process.exit(2);
  }
  throw error;
}
