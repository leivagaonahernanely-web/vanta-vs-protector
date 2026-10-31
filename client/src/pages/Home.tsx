import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { readLuaFile, validateLuaFile } from "@/lib/lua-upload";
import { trpc } from "@/lib/trpc";

const OPT_BLOCK = "--NXT_LPH_OPTIMIZACION\n\n--NXT_LPH_OPTIMIZACION_END\n";
const PROT_BLOCK = "--NXT_LPH_PROTECCION\n\n--NXT_LPH_PROTECCION_END\n";

// NextOfuscator: acceso con correo y NX_KEY, cuenta, API key y ofuscador. Diseño en blanco y negro.
export default function Home() {
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery();

  if (me.isLoading) {
    return <main className="min-h-screen bg-black p-8 text-white">Cargando…</main>;
  }
  if (!me.data) return <AccessScreen onDone={() => utils.auth.me.invalidate()} />;
  return <Workspace user={me.data} onLogout={() => utils.auth.me.invalidate()} />;
}

function AccessScreen({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nxKey, setNxKey] = useState("");

  const login = trpc.auth.login.useMutation({
    onSuccess: () => onDone(),
    onError: (error) => toast.error(error.message),
  });
  const register = trpc.auth.register.useMutation({
    onSuccess: () => {
      toast.success("Cuenta creada. Ahora inicia sesión.");
      setMode("login");
      setNxKey("");
    },
    onError: (error) => toast.error(error.message),
  });

  const field = "w-full border border-white/30 bg-black px-3 py-2 text-white placeholder:text-white/40 outline-none focus:border-white";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black p-8 text-white">
      <h1 className="text-4xl font-bold tracking-tight">NextOfuscator</h1>
      <div className="flex w-full max-w-sm gap-2">
        <button onClick={() => setMode("login")} className={`flex-1 border py-2 ${mode === "login" ? "bg-white text-black" : "border-white/30"}`}>Iniciar sesión</button>
        <button onClick={() => setMode("register")} className={`flex-1 border py-2 ${mode === "register" ? "bg-white text-black" : "border-white/30"}`}>Crear cuenta</button>
      </div>
      <form
        className="flex w-full max-w-sm flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === "login") login.mutate({ email, password });
          else register.mutate({ email, password, nxKey });
        }}
      >
        <input className={field} type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={field} type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {mode === "register" && (
          <input className={field} placeholder="NX_KEY-XXXX-XXXX-XXXX-XXXX" value={nxKey} onChange={(e) => setNxKey(e.target.value)} required />
        )}
        <Button type="submit" className="bg-white text-black hover:bg-neutral-200" disabled={login.isPending || register.isPending}>
          {mode === "login" ? "Entrar" : "Crear cuenta"}
        </Button>
      </form>
      {mode === "register" && <p className="max-w-sm text-center text-sm text-white/60">Necesitas una NX_KEY Premium para crear cuenta. Se escribe exactamente como la recibiste.</p>}
    </main>
  );
}

type Me = NonNullable<ReturnType<typeof trpc.auth.me.useQuery>["data"]>;

function Workspace({ user, onLogout }: { user: Me; onLogout: () => void }) {
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => onLogout() });
  const isPremium = user.plan === "premium";

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/20 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">NextOfuscator</h1>
        <div className="flex items-center gap-4 text-sm text-white/70">
          <span>{user.email}</span>
          <span className="border border-white/40 px-2 py-0.5">{isPremium ? "Premium" : "Sin plan Premium"}</span>
          <button onClick={() => logout.mutate()} className="underline">Salir</button>
        </div>
      </header>

      {!isPremium && (
        <p className="mb-6 border border-white/30 p-4 text-white/80">Tu cuenta no tiene plan Premium. Canjea una NX_KEY para usar el ofuscador.</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>{isPremium ? <Obfuscator /> : null}</div>
        <aside className="space-y-6">
          {isPremium && <ApiKeyPanel hasKey={user.hasApiKey} domain={user.apiKeyDomain} />}
          {user.role === "admin" && <AdminPanel />}
        </aside>
      </div>
    </main>
  );
}

function Obfuscator() {
  const [source, setSource] = useState("");
  const [output, setOutput] = useState("");
  const run = trpc.obfuscator.run.useMutation({
    onSuccess: (result) => {
      setOutput(result.code);
      toast.success("Script ofuscado");
    },
    onError: (error) => toast.error(error.message),
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
    const url = URL.createObjectURL(new Blob([output], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "nextofuscator.lua";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input type="file" accept=".lua,text/plain" onChange={(e) => loadFile(e.target.files?.[0])} className="text-sm text-white/70" />
        <Button variant="outline" onClick={() => setSource((s) => s + OPT_BLOCK)} className="border-white text-white hover:bg-white hover:text-black">
          Insertar OPTIMIZACION
        </Button>
        <Button variant="outline" onClick={() => setSource((s) => s + PROT_BLOCK)} className="border-white text-white hover:bg-white hover:text-black">
          Insertar PROTECCION
        </Button>
      </div>
      <Textarea
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder="Pega aquí tu script Lua"
        className="min-h-[320px] border-white/30 bg-black font-mono text-white placeholder:text-white/40"
      />
      <Button onClick={() => run.mutate({ source })} disabled={run.isPending || !source.trim()} className="bg-white text-black hover:bg-neutral-200">
        {run.isPending ? "Ofuscando…" : "Ofuscar"}
      </Button>
      <Textarea value={output} readOnly placeholder="Aquí aparecerá el archivo ofuscado" className="min-h-[200px] border-white/30 bg-black font-mono text-white placeholder:text-white/40" />
      <div className="flex gap-3">
        <Button variant="outline" disabled={!output} onClick={() => navigator.clipboard.writeText(output).then(() => toast.success("Copiado"))} className="border-white text-white hover:bg-white hover:text-black">Copiar</Button>
        <Button variant="outline" disabled={!output} onClick={download} className="border-white text-white hover:bg-white hover:text-black">Descargar</Button>
      </div>
    </section>
  );
}

function ApiKeyPanel({ hasKey, domain }: { hasKey: boolean; domain: string | null }) {
  const [input, setInput] = useState(domain ?? "");
  const [shown, setShown] = useState<string | null>(null);
  const regenerate = trpc.apiKeys.regenerate.useMutation({
    onSuccess: (result) => {
      setShown(result.key);
      toast.success("API key generada. Cópiala ahora: no se volverá a mostrar.");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <section className="space-y-3 border border-white/30 p-4">
      <h2 className="font-semibold">API key</h2>
      <p className="text-sm text-white/60">
        {hasKey ? `Vinculada a ${domain}. Generar una nueva invalida la anterior.` : "Aún no tienes una API key."}
      </p>
      <input
        className="w-full border border-white/30 bg-black px-3 py-2 text-white placeholder:text-white/40 outline-none focus:border-white"
        placeholder="ejemplo.com"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <Button onClick={() => regenerate.mutate({ domain: input })} disabled={regenerate.isPending} className="w-full bg-white text-black hover:bg-neutral-200">
        {hasKey ? "Regenerar API key" : "Generar API key"}
      </Button>
      {shown && <code className="block break-all border border-white/40 p-2 text-sm">{shown}</code>}
    </section>
  );
}

function AdminPanel() {
  const [key, setKey] = useState<string | null>(null);
  const generate = trpc.nxKeys.generate.useMutation({
    onSuccess: (result) => setKey(result.key),
    onError: (error) => toast.error(error.message),
  });
  return (
    <section className="space-y-3 border border-white/30 p-4">
      <h2 className="font-semibold">Administrador</h2>
      <Button onClick={() => generate.mutate()} disabled={generate.isPending} className="w-full bg-white text-black hover:bg-neutral-200">
        Generar NX_KEY
      </Button>
      {key && <code className="block break-all border border-white/40 p-2 text-sm">{key}</code>}
    </section>
  );
}
