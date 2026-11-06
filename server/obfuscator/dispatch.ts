// Árbol de despacho del intérprete, generado a partir de la plantilla del runtime.
// Cada instrucción tiene su cuerpo (tal cual está en la plantilla); aquí solo cambia cómo se
// llega a él: las tres instrucciones más frecuentes siguen primero, y el resto va en un árbol
// binario cuya forma depende de la semilla. Los cuerpos no se modifican.

export type Leaf = { op: number; body: string };

const LEAF_IF = /^(\s*)(?:if|elseif) op == (\d+) then\b/;
const LEAF_ELSE = /^(\s*)else -- [A-Z_0-9]+ \((\d+)\)/;

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

// Localiza la región del despacho y extrae el cuerpo de cada instrucción.
export function extractDispatch(template: string): { before: string; after: string; leaves: Leaf[] } {
  const lines = template.split("\n");
  const start = lines.findIndex((l) => l.startsWith("      if op == 1 then"));
  if (start < 0) throw new Error("no se encontró el inicio del despacho");
  // La región termina en "      end" justo antes del "    end" que cierra el bucle.
  let stop = -1;
  for (let i = start; i < lines.length; i++) {
    if (lines[i] === "    end") {
      stop = i - 1;
      break;
    }
  }
  if (stop < 0 || lines[stop] !== "      end") throw new Error("no se encontró el fin del despacho");

  const leaves: Leaf[] = [];
  for (let i = start; i < stop; i++) {
    const line = lines[i];
    const m = LEAF_IF.exec(line) ?? LEAF_ELSE.exec(line);
    if (!m) continue;
    const indent = indentOf(line);
    const op = Number(m[2] ?? m[2]);
    const body: string[] = [];
    let j = i + 1;
    for (; j < stop; j++) {
      const t = lines[j].trim();
      if (indentOf(lines[j]) <= indent && (t.startsWith("elseif ") || t === "else" || t.startsWith("else ") || t === "end")) break;
      body.push(lines[j]);
    }
    leaves.push({ op, body: body.join("\n") });
  }
  return {
    before: lines.slice(0, start).join("\n"),
    after: lines.slice(stop + 1).join("\n"),
    leaves,
  };
}

// Genera el despacho: las tres primeras instrucciones como comparaciones directas y el resto en
// un árbol binario con pivotes aleatorios según la semilla.
export function generateDispatch(leaves: Leaf[], seed: number): string {
  const byOp = new Map(leaves.map((l) => [l.op, l.body]));
  const fast = [1, 2, 3];
  for (const op of fast) if (!byOp.has(op)) throw new Error(`falta la instrucción ${op}`);
  const rest = leaves.map((l) => l.op).filter((op) => !fast.includes(op)).sort((a, b) => a - b);

  let s = seed >>> 0;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };

  const leafCode = (op: number, indent: string) =>
    `${indent}if op == ${op} then\n${byOp.get(op)}\n${indent}end`;

  const tree = (ops: number[], indent: string): string => {
    if (ops.length === 1) return leafCode(ops[0], indent);
    // Pivote entre 1 y len-1, con un sesgo hacia el centro para no degenerar en cadena.
    const lo = Math.max(1, Math.floor(ops.length * 0.3));
    const hi = Math.min(ops.length - 1, Math.ceil(ops.length * 0.7));
    const cut = lo + Math.floor(rand() * (hi - lo + 1));
    const left = ops.slice(0, cut);
    const right = ops.slice(cut);
    const pivot = left[left.length - 1];
    const inner = indent + "  ";
    return `${indent}if op <= ${pivot} then\n${tree(left, inner)}\n${indent}else\n${tree(right, inner)}\n${indent}end`;
  };

  const head = fast.map((op, i) => `${i === 0 ? "      if" : "      elseif"} op == ${op} then\n${byOp.get(op)}`).join("\n");
  return `${head}\n      else\n${tree(rest, "        ")}\n      end`;
}
