// Mide la VM con las cargas de workloads.lua. Cada sección (marcada con "-- N)") es independiente y
// se ejecuta en tres variantes:
//   - nativo: Lua sin tocar.
//   - vm: todo protegido (sin macros).
//   - macros: los bucles calientes (secciones 2 a 5) van en --NXT_LPH_OPTIMIZACION; el resto, protegido.
// Compara salidas y tiempos. Uso: NX_LUA_BIN=lua5.1 RUNS=3 pnpm tsx scripts/bench/run.ts
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildLua } from "../../server/obfuscator/build";

const LUA = process.env.NX_LUA_BIN ?? "lua5.1";
const RUNS = Number(process.env.RUNS ?? 3);
const source = readFileSync(join(import.meta.dirname, "workloads.lua"), "utf8");
const dir = mkdtempSync(join(tmpdir(), "nx-bench-"));

// Divide el archivo en secciones que empiezan con "-- N)" (cada una es autocontenida).
const sections = source.split(/^(?=-- \d\))/m).filter((s) => /^-- \d\)/.test(s));

// Quita los macros: en la variante por defecto todo va protegido.
const plain = (code: string) => code.replace(/^--NXT_LPH_.*\n?/gm, "");
// Sección con su bucle caliente marcado como nativo (uso recomendado de los macros).
const HOT = new Set([2, 3, 4, 5]);
const withHotMacro = (sec: string, index: number) =>
  HOT.has(index) ? `--NXT_LPH_OPTIMIZACION\n${plain(sec)}\n--NXT_LPH_OPTIMIZACION_END\n` : plain(sec);

function run(file: string): { ms: number; out: string } {
  let out = "";
  let best = Infinity;
  for (let r = 0; r < RUNS; r++) {
    const t0 = process.hrtime.bigint();
    out = execFileSync(LUA, [file], { encoding: "utf8" });
    best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6);
  }
  return { ms: best, out };
}

try {
  let totalNative = 0;
  let totalVm = 0;
  let totalMacros = 0;
  let bad = 0;
  sections.forEach((sec, i) => {
    const name = sec.split("\n")[0].replace(/^-- /, "");
    const nativeFile = join(dir, `n${i}.lua`);
    const vmFile = join(dir, `v${i}.lua`);
    const macroFile = join(dir, `m${i}.lua`);
    writeFileSync(nativeFile, plain(sec));
    writeFileSync(vmFile, buildLua(plain(sec), 1000 + i).code);
    writeFileSync(macroFile, buildLua(withHotMacro(sec, i + 1), 2000 + i).code);
    const n = run(nativeFile);
    const v = run(vmFile);
    const m = run(macroFile);
    totalNative += n.ms;
    totalVm += v.ms;
    totalMacros += m.ms;
    const same = n.out === v.out && n.out === m.out;
    if (!same) bad++;
    console.log(
      `${name.padEnd(12)} nativo ${n.ms.toFixed(0).padStart(5)} ms   vm ${v.ms.toFixed(0).padStart(6)} ms (x${(v.ms / n.ms).toFixed(1).padStart(5)})` +
        `   macros ${m.ms.toFixed(0).padStart(5)} ms (x${(m.ms / n.ms).toFixed(1).padStart(4)})  ${same ? "ok" : "SALIDA DISTINTA"}`,
    );
  });
  console.log(
    `TOTAL        nativo ${totalNative.toFixed(0).padStart(5)} ms   vm ${totalVm.toFixed(0).padStart(6)} ms (x${(totalVm / totalNative).toFixed(1)})` +
      `   macros ${totalMacros.toFixed(0).padStart(5)} ms (x${(totalMacros / totalNative).toFixed(1)})`,
  );
  if (bad) process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
