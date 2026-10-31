import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { startLogin } from "@/const";
import { readLuaFile, validateLuaFile } from "@/lib/lua-upload";
import { trpc } from "@/lib/trpc";

// NextOfuscator: pantalla única del ofuscador. Diseño en blanco y negro.
export default function Home() {
  const me = trpc.auth.me.useQuery();
  const [source, setSource] = useState("");
  const [output, setOutput] = useState("");

  const run = trpc.obfuscator.run.useMutation({
    onSuccess: (result) => {
      setOutput(result.code);
      toast.success("Script ofuscado");
    },
    onError: (error) => toast.error(error.message || "No se pudo ofuscar el script"),
  });

  const loadFile = async (file?: File) => {
    if (!file) return;
    const error = validateLuaFile(file);
    if (error) return toast.error(error);
    try {
      setSource(await readLuaFile(file));
    } catch {
      toast.error("No se pudo leer el archivo Lua");
    }
  };

  const download = () => {
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nextofuscator.lua";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (me.isLoading) {
    return <main className="min-h-screen bg-black p-8 text-white">Cargando…</main>;
  }

  if (!me.data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black p-8 text-white">
        <h1 className="text-4xl font-bold tracking-tight">NextOfuscator</h1>
        <Button onClick={() => startLogin()} className="bg-white text-black hover:bg-neutral-200">
          Iniciar sesión
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <header className="mb-6 flex items-center justify-between border-b border-white/20 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">NextOfuscator</h1>
        <span className="text-sm text-white/60">{me.data.plan === "premium" ? "Premium" : "Free"}</span>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="text-sm text-white/70">Código Lua</label>
          <input
            type="file"
            accept=".lua,text/plain"
            onChange={(e) => loadFile(e.target.files?.[0])}
            className="block text-sm text-white/70"
          />
          <Textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Pega aquí tu script Lua"
            className="min-h-[360px] border-white/30 bg-black font-mono text-white placeholder:text-white/40"
          />
          <Button
            onClick={() => run.mutate({ source })}
            disabled={run.isPending || !source.trim()}
            className="bg-white text-black hover:bg-neutral-200"
          >
            {run.isPending ? "Ofuscando…" : "Ofuscar"}
          </Button>
        </div>

        <div className="space-y-3">
          <label className="text-sm text-white/70">Resultado</label>
          <Textarea
            value={output}
            readOnly
            placeholder="Aquí aparecerá el archivo ofuscado"
            className="min-h-[360px] border-white/30 bg-black font-mono text-white placeholder:text-white/40"
          />
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigator.clipboard.writeText(output).then(() => toast.success("Copiado"))}
              disabled={!output}
              className="border-white text-white hover:bg-white hover:text-black"
            >
              Copiar
            </Button>
            <Button
              variant="outline"
              onClick={download}
              disabled={!output}
              className="border-white text-white hover:bg-white hover:text-black"
            >
              Descargar
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
