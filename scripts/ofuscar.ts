// Uso:
//   npx tsx scripts/ofuscar.ts                       ofusca todo Inputs/*.lua en Output/
//   npx tsx scripts/ofuscar.ts entrada.lua [salida.lua]
// Opciones: --sugerir (solo lista dónde poner macros)  --semilla N  --pasadas N  --codigo-muerto R (0 a 1, por defecto 0.5)  --auto-nativo
// Usa el mismo motor que la web, sin login ni API key.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import { basename, join } from "node:path";
import { BuildError, buildLua, suggestMacros } from "../server/obfuscator/build";

const INPUT_DIR = "Inputs";
const OUTPUT_DIR = "Output";

const args = process.argv.slice(2);
const BOOLEAN_FLAGS = new Set(["sugerir", "auto-nativo"]);
const flags: Record<string, string> = {};
const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) {
    const name = args[i].slice(2);
    // Las banderas sin valor no consumen el siguiente argumento.
    flags[name] = BOOLEAN_FLAGS.has(name) ? "" : args[++i] ?? "";
  }
  else positional.push(args[i]);
}

const seed = flags["semilla"] ? Number(flags["semilla"]) : randomInt(1, 2 ** 31);
const passes = flags["pasadas"] ? Number(flags["pasadas"]) : 1;
const deadCodeRate = flags["codigo-muerto"] ? Number(flags["codigo-muerto"]) : 0.5;
// Sin macros: bucles y callbacks van nativos (más rápido, menos protegido).
const autoNative = "auto-nativo" in flags;
if (!Number.isInteger(passes) || passes < 1) {
  console.error("--pasadas debe ser un entero mayor o igual a 1");
  process.exit(1);
}
if (!(deadCodeRate >= 0 && deadCodeRate <= 1)) {
  console.error("--codigo-muerto debe estar entre 0 y 1");
  process.exit(1);
}

if ("sugerir" in flags) {
  // Solo muestra dónde conviene poner macros; no escribe ningún archivo.
  const input = positional[0];
  if (!input) {
    console.error("Uso: ofuscar.ts --sugerir archivo.lua");
    process.exit(1);
  }
  const text = readFileSync(input, "utf8");
  const found = suggestMacros(text);
  console.log(found.length ? found.join("\n") : "No hay bucles ni funciones de nivel principal que sugerir.");
  process.exit(0);
}

// Lista de trabajos: pares [entrada, salida].
let jobs: [string, string][];
if (positional.length === 0) {
  if (!existsSync(INPUT_DIR)) {
    console.error(`No existe la carpeta ${INPUT_DIR}/. Coloca ahí tus scripts .lua o pasa un archivo.`);
    process.exit(1);
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });
  jobs = readdirSync(INPUT_DIR)
    .filter((f) => f.endsWith(".lua"))
    .sort()
    .map((f) => [join(INPUT_DIR, f), join(OUTPUT_DIR, f)] as [string, string]);
  if (jobs.length === 0) {
    console.error(`${INPUT_DIR}/ no tiene archivos .lua`);
    process.exit(1);
  }
} else {
  const input = positional[0];
  const output = positional[1] ?? join(OUTPUT_DIR, basename(input));
  jobs = [[input, output]];
}

let failed = false;
for (const [input, output] of jobs) {
  try {
    const { code, segments } = buildLua(readFileSync(input, "utf8"), seed, { passes, deadCodeRate, autoNative });
    mkdirSync(dirnameOf(output), { recursive: true });
    writeFileSync(output, code, "utf8");
    console.log(`OK: ${output} (${segments} segmento(s), ${passes} pasada(s), semilla ${seed})`);
  } catch (error) {
    failed = true;
    if (error instanceof BuildError) {
      console.error(`Error en ${input}: ${error.message}`);
    } else {
      throw error;
    }
  }
}
process.exit(failed ? 2 : 0);

function dirnameOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i <= 0 ? "." : path.slice(0, i);
}
