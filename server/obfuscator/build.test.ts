import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { autoSegments, BuildError, buildLua, splitSegments } from "./build";

const LUA = process.env.NX_LUA_BIN ?? "lua5.1";
function luaAvailable(): boolean {
  try {
    execFileSync(LUA, ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("macros de optimización y protección", () => {
  it("sin macros, todo el script va protegido", () => {
    const segs = splitSegments("local a = 1\nprint(a)");
    expect(segs).toEqual([{ kind: "protected", source: "local a = 1\nprint(a)", line: 1 }]);
  });

  it("OPTIMIZACION deja el bloque nativo y el resto protegido", () => {
    const src = [
      "local a = 1",
      "--NXT_LPH_OPTIMIZACION",
      "function tick() return 2 end",
      "--NXT_LPH_OPTIMIZACION_END",
      "print(a)",
    ].join("\n");
    expect(splitSegments(src).map((s) => [s.kind, s.line])).toEqual([
      ["protected", 1],
      ["native", 3],
      ["protected", 5],
    ]);
  });

  it("si hay PROTECCION, solo esos bloques se protegen y el resto queda nativo", () => {
    const src = [
      "print('abierto')",
      "--NXT_LPH_PROTECCION",
      "local secreto = 42",
      "--NXT_LPH_PROTECCION_END",
      "print('final')",
    ].join("\n");
    expect(splitSegments(src).map((s) => s.kind)).toEqual(["native", "protected", "native"]);
  });

  it("rechaza macros anidados, cierres sin apertura y macros sin cerrar", () => {
    expect(() => splitSegments("--NXT_LPH_OPTIMIZACION\n--NXT_LPH_PROTECCION\n--NXT_LPH_PROTECCION_END\n--NXT_LPH_OPTIMIZACION_END"))
      .toThrow(/no se pueden anidar/);
    expect(() => splitSegments("--NXT_LPH_OPTIMIZACION_END")).toThrow(/sin apertura/);
    expect(() => splitSegments("--NXT_LPH_OPTIMIZACION\nprint(1)")).toThrow(/sin cerrar/);
  });

  it("no permite que una variable local cruce entre bloques", () => {
    const src = [
      "--NXT_LPH_OPTIMIZACION",
      "local cfg = 10",
      "--NXT_LPH_OPTIMIZACION_END",
      "print(cfg)",
    ].join("\n");
    expect(() => buildLua(src, 1)).toThrow(/'cfg' se declara en un bloque/);
  });

  it("sí permite compartir globales entre bloques", () => {
    const src = [
      "--NXT_LPH_OPTIMIZACION",
      "function tick() total = (total or 0) + 1 end",
      "--NXT_LPH_OPTIMIZACION_END",
      "for i = 1, 3 do tick() end",
    ].join("\n");
    expect(() => buildLua(src, 1)).not.toThrow();
  });

  it("reporta errores de sintaxis con la línea original del archivo", () => {
    const src = ["local a = 1", "--NXT_LPH_OPTIMIZACION", "local = 2", "--NXT_LPH_OPTIMIZACION_END"].join("\n");
    try {
      buildLua(src, 1);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BuildError);
      expect((error as BuildError).line).toBe(3);
    }
  });

  it("la salida nativa va dentro de do...end para acotar sus locales", () => {
    const { code } = buildLua("--NXT_LPH_OPTIMIZACION\nlocal x = 1\n--NXT_LPH_OPTIMIZACION_END", 1);
    expect(code).toContain("do\nlocal x = 1\nend");
  });

  it("el bloque previo espera dos Heartbeat en Roblox y usa sintaxis Lua 5.1", () => {
    const { code } = buildLua("return 1", 1);
    expect(code).toContain("until RanTimes >= 2");
    expect(code).toContain("RanTimes = RanTimes + 1");
    expect(code).not.toContain("+=");
    expect(code.indexOf("until RanTimes") < code.indexOf("local function nx_run")).toBe(true);
  });
});

describe("salida ofuscada con macros: equivalencia en Lua", () => {
  const available = luaAvailable();
  const runIt = available ? it : it.skip;

  const cases: [string, string][] = [
    ["sin macros", "local t = {}\nfor i = 1, 5 do t[#t + 1] = i * i end\nreturn t[5]"],
    [
      "optimización con globales compartidas",
      [
        "count = 0",
        "--NXT_LPH_OPTIMIZACION",
        "function tick() total = (total or 0) + 1 end",
        "--NXT_LPH_OPTIMIZACION_END",
        "for i = 1, 3 do tick() count = count + 1 end",
        "return total * 10 + count",
      ].join("\n"),
    ],
    [
      "solo protección marcada",
      [
        "total = 0",
        "--NXT_LPH_PROTECCION",
        "local function add(x) return x + 2 end",
        "total = add(total)",
        "--NXT_LPH_PROTECCION_END",
        "total = total + 1",
        "return total",
      ].join("\n"),
    ],
    // Regresiones: '#' debe ser O(log n) y pcall no debe dejar inflada la profundidad de llamadas.
    ["longitud en bucle de append", "local t = {}\nfor i = 1, 3000 do t[#t + 1] = i end\nreturn #t"],
    [
      "pcall no deja la profundidad inflada",
      [
        "local function bad() error('x') end",
        "local function good() return 42 end",
        "for i = 1, 1500 do pcall(bad) end",
        "if pcall(good) then return 'OK' end",
        "return 'FALLA'",
      ].join("\n"),
    ],
  ];

  for (const [name, src] of cases) {
    runIt(`produce el mismo resultado: ${name}`, () => {
      const { code } = buildLua(src, 5);
      const expectedTs = (() => {
        // Resultado de referencia: el mismo código nativo ejecutado en Lua.
        const dir = mkdtempSync(join(tmpdir(), "nx-build-"));
        try {
          const file = join(dir, "native.lua");
          writeFileSync(file, `local __r = (function()\n${src}\nend)()\nprint(__r)\n`);
          return execFileSync(LUA, [file], { encoding: "utf8" }).trimEnd();
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      })();

      const dir = mkdtempSync(join(tmpdir(), "nx-build-"));
      try {
        const file = join(dir, "out.lua");
        // Envuelve el archivo en una función, como lo haría un loader, para recoger su "return".
        writeFileSync(file, `local __r = (function()\n${code}\nend)()\nprint(__r)\n`);
        const actual = execFileSync(LUA, [file], { encoding: "utf8" }).trimEnd();
        expect(actual).toBe(expectedTs);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});

describe("reparto automático sin macros", () => {
  it("un bucle que solo usa globales va nativo", () => {
    const segs = autoSegments("print('inicio')\nfor i = 1, 3 do print(i) end\nprint('fin')");
    expect(segs.map((s) => s.kind)).toEqual(["protected", "native", "protected"]);
  });

  it("un callback con una función literal va nativo si no comparte locales", () => {
    const segs = autoSegments("x = 1\nbutton.Click:Connect(function() print('hola') end)");
    expect(segs.map((s) => s.kind)).toEqual(["protected", "native"]);
  });

  it("un bucle que usa una local del script no se separa del resto", () => {
    const segs = autoSegments("local n = 0\nfor i = 1, 3 do n = n + i end\nprint(n)");
    expect(segs.every((s) => s.kind === "protected")).toBe(true);
  });

  it("genera el archivo con el runtime aunque haya bloques nativos", () => {
    const src = "local n = 0\nfor i = 1, 3 do n = n + i end\nreturn n";
    const { code } = buildLua(src, 9);
    expect(code).toContain("nx_run");
  });
});

describe("salida sin comentarios", () => {
  it("el archivo generado no contiene comentarios Lua", () => {
    const src = "local n = 0\nfor i = 1, 3 do n = n + i end -- comentario\n--[[ bloque ]] print(n)";
    const { code } = buildLua(src, 4);
    expect(code.split("\n").slice(1).some((l) => l.includes("--"))).toBe(false);
    expect(code.split("\n")[0]).toBe("--Protect by NextOfuscator");
  });
});
