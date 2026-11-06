import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { B64_VARIANTS } from "./runtime";

const LUA = process.env.NX_LUA_BIN ?? "lua5.1";
const luaAvailable = () => {
  try {
    execFileSync(LUA, ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

// Literal de Lua con cada byte escapado: funciona con cualquier contenido.
const luaBytes = (text: string) => '"' + [...text].map((c) => "\\" + c.charCodeAt(0)).join("") + '"';

describe("decodificadores base64 del runtime", () => {
  it("las tres variantes decodifican igual que Buffer", () => {
    if (!luaAvailable()) return;
    const samples = ["", "a", "ab", "abc", "abcd", "hola ñandú ✓", "\x00\xff\x80\x07\x40"];
    const dir = mkdtempSync(join(tmpdir(), "nx-b64-"));
    try {
      B64_VARIANTS.forEach((variant, idx) => {
        const checks = samples.map((text) => {
          const bytes = Buffer.from(text, "utf8").toString("latin1");
          const b64 = Buffer.from(bytes, "latin1").toString("base64");
          return `if b64dec("${b64}") ~= ${luaBytes(bytes)} then error("variante ${idx}: ${b64}") end`;
        });
        const file = join(dir, `v${idx}.lua`);
        writeFileSync(file, variant + "\n" + checks.join("\n") + "\n");
        expect(() => execFileSync(LUA, [file])).not.toThrow();
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
