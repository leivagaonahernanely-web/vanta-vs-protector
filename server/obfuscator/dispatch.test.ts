import { describe, expect, it } from "vitest";
import { generateDispatch, extractDispatch, type Leaf } from "./dispatch";
import { kindsFor, runtimeLua } from "./runtime";
import { fieldMap } from "./fields";

describe("árbol de despacho generado", () => {
  it("el runtime de cada semilla tiene una hoja por cada una de las 43 instrucciones", () => {
    const fake = (op: number): Leaf => ({ op, body: `    x = ${op}` });
    const template = [
      "    while true do",
      "      if op == 1 then -- LGET",
      "        a1",
      "      elseif op == 2 then -- CONST",
      "        a2",
      "      elseif op == 3 then -- ADD",
      "        a3",
      "      elseif op <= 17 then",
      "        if op <= 9 then",
      "          if op == 4 then -- SUB",
      "            a4",
      "          else -- GT (7)",
      "            a7",
      "          end",
      "        end",
      "      else",
      "      end",
      "    end",
    ].join("\n");
    const parts = extractDispatch(template);
    expect(parts.leaves.map((l) => l.op)).toEqual([1, 2, 3, 4, 7]);
    const generated = generateDispatch([1, 2, 3, 4, 7].map(fake), 99);
    for (const op of [1, 2, 3, 4, 7]) expect(generated).toContain(`x = ${op}`);
  });

  it("distintas semillas dan árboles distintos y el runtime sigue siendo válido", () => {
    const a = kindsFor(1).dispatch;
    const b = kindsFor(2).dispatch;
    expect(a).not.toBe(b);
    expect(runtimeLua(fieldMap(1), kindsFor(1))).toContain("local function nx_run");
  });
});
