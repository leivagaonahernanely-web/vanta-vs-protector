import { useMemo, useState } from "react";
import { Code2, Copy, FileText, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type BlockKind = "lua" | "text";
type BuilderBlock = { id: number; kind: BlockKind; content: string };

export function composeBlocks(blocks: Array<Pick<BuilderBlock, "content">>) {
  return blocks.map((block) => block.content.trim()).filter(Boolean).join("\n\n");
}

const initialBlocks: BuilderBlock[] = [
  { id: 1, kind: "lua", content: "print(\"Hello from Vanta.vs\")" },
  { id: 2, kind: "text", content: "-- Texto descriptivo entre bloques" },
];

export function BlockBuilderPanel() {
  const [blocks, setBlocks] = useState<BuilderBlock[]>(initialBlocks);
  const output = useMemo(() => composeBlocks(blocks), [blocks]);

  function addBlock(kind: BlockKind) {
    setBlocks((current) => [...current, { id: Date.now(), kind, content: "" }]);
  }

  function updateBlock(id: number, content: string) {
    setBlocks((current) => current.map((block) => block.id === id ? { ...block, content } : block));
  }

  function removeBlock(id: number) {
    setBlocks((current) => current.filter((block) => block.id !== id));
  }

  async function copyOutput() {
    if (!output) return toast.error("Añade contenido Lua o texto antes de copiar");
    try {
      await navigator.clipboard.writeText(output);
      toast.success("Source Lua copiada");
    } catch {
      toast.error("El navegador no permitió copiar la source");
    }
  }

  return <section className="panel manager-panel block-builder-panel">
    <div className="panel-header"><div><span className="overline">SOURCE COMPOSER</span><h2><GripVertical size={17} /> Block Builder</h2><p>Construye una source ordenada con bloques de Lua y texto.</p></div><span className="panel-index">LUA / TEXT</span></div>
    <div className="form-actions"><Button variant="outline" className="secondary-button" onClick={() => addBlock("lua")}><Code2 size={15} /> Añadir Lua</Button><Button variant="outline" className="secondary-button" onClick={() => addBlock("text")}><FileText size={15} /> Añadir texto</Button></div>
    <div className="block-list">{blocks.length === 0 ? <div className="empty-row">No hay bloques. Añade Lua o texto para comenzar.</div> : blocks.map((block, index) => <article className={`builder-block builder-block-${block.kind}`} key={block.id}><div className="builder-block-head"><strong>{String(index + 1).padStart(2, "0")} · {block.kind === "lua" ? "LUA" : "TEXT"}</strong><button className="text-action text-button danger" onClick={() => removeBlock(block.id)}><Trash2 size={14} /> Quitar</button></div><Textarea value={block.content} onChange={(event) => updateBlock(block.id, event.target.value)} placeholder={block.kind === "lua" ? "Escribe un bloque de código Lua..." : "Escribe una nota o texto para incluir en la source..."} spellCheck={false} /></article>)}</div>
    <div className="builder-output"><div className="panel-header"><div><h3>Source final</h3><p>Se conserva el orden de los bloques y se entrega como texto Lua.</p></div><Button variant="outline" className="secondary-button" onClick={() => void copyOutput()}><Copy size={15} /> Copiar</Button></div><pre>{output || "La source final aparecerá aquí."}</pre></div>
  </section>;
}
