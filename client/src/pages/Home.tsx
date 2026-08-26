import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Check, Code2, Copy, Download, ExternalLink, FileCode2, FolderCode, KeyRound, LayoutDashboard, Link2, LogOut, Menu, Plus, ShieldCheck, Terminal } from "lucide-react";

const exampleLua = `local Players = game:GetService("Players")\n\nlocal function greet(player)\n  print("Hello, " .. player.Name)\nend\n\nPlayers.PlayerAdded:Connect(greet)`;

type HostedItem = { id: number; slug: string; name: string; description: string; ffaMode: boolean; createdAt: string; url: string; loader: string };

function downloadText(filename: string, value: string) {
  const blob = new Blob([value], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const copy = async () => { await navigator.clipboard.writeText(value); toast.success("Copiado al portapapeles"); };
  return <button className="icon-copy" onClick={copy} aria-label={label}><Copy size={15} /></button>;
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState("Scripts");
  const [name, setName] = useState("mi-script.lua");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [ffaMode, setFfaMode] = useState(false);
  const [obfuscateSource, setObfuscateSource] = useState(true);
  const [hostedResult, setHostedResult] = useState<HostedItem | null>(null);
  const hostedQuery = trpc.hostedScripts.list.useQuery(undefined, { enabled: isAuthenticated });
  const hostScript = trpc.hostedScripts.create.useMutation({
    onSuccess: (item) => { setHostedResult(item); setSource(""); void hostedQuery.refetch(); toast.success("Script alojado"); },
    onError: (error) => toast.error(error.message || "No se pudo alojar el script"),
  });

  function createHosted() {
    if (!source.trim()) { toast.error("Pega el código Lua antes de alojarlo"); return; }
    hostScript.mutate({ name, description: description || undefined, source, ffaMode, obfuscateSource });
  }
  function connectDiscord() { window.location.assign(`/api/discord/start?origin=${encodeURIComponent(window.location.origin)}`); }
  function selectNav(item: string) { setActive(item); setMobileOpen(false); }

  if (loading) return <div className="auth-screen"><div className="auth-card"><div className="auth-icon"><Code2 size={19} /></div><div className="skeleton-line" /><div className="skeleton-line short" /></div></div>;

  if (!isAuthenticated) return <div className="auth-screen"><div className="auth-card"><div className="auth-icon"><Code2 size={20} /></div><h1>Inicia sesión para continuar</h1><p>Accede a tu workspace para proteger y alojar tus scripts Lua.</p><Button className="primary-button full-button" onClick={() => startLogin()}>Continuar con acceso <ExternalLink size={15} /></Button><div className="auth-foot"><span>Vanta.vs Protector</span><span>Secure workspace</span></div></div><span className="made-by">Built for controlled delivery</span></div>;

  const scripts = (hostedQuery.data ?? []) as HostedItem[];
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
      <div className="sidebar-brand"><span className="brand-symbol"><ShieldCheck size={18} /></span><span><strong>Vanta.vs</strong><small>Protector</small></span></div>
      <div className="workspace-switch"><span className="workspace-dot" /> <span>Personal workspace</span><span className="chevron">⌄</span></div>
      <nav className="side-nav">
        <p className="nav-label">Workspace</p>
        <button className={active === "Overview" ? "active" : ""} onClick={() => selectNav("Overview")}><LayoutDashboard size={16} /> Overview</button>
        <button className={active === "Scripts" ? "active" : ""} onClick={() => selectNav("Scripts")}><FolderCode size={16} /> Scripts <span className="nav-badge">{scripts.length}</span></button>
        <button className={active === "Obfuscator" ? "active" : ""} onClick={() => selectNav("Obfuscator")}><Code2 size={16} /> Obfuscator</button>
        <p className="nav-label">Protection</p>
        <button onClick={() => toast.info("La gestión de claves estará disponible próximamente")}><KeyRound size={16} /> License keys</button>
        <button onClick={() => toast.info("La protección HWID estará disponible próximamente")}><ShieldCheck size={16} /> HWID bans</button>
        <p className="nav-label">Settings</p>
        <button onClick={connectDiscord}><Link2 size={16} /> {user?.discordUsername ? "Discord conectado" : "Conectar Discord"}</button>
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-user"><span className="avatar">{(user?.name || "V").slice(0, 1).toUpperCase()}</span><span><strong>{user?.name || "Cuenta"}</strong><small>{user?.email || "Usuario"}</small></span><button onClick={() => logout()} aria-label="Cerrar sesión"><LogOut size={15} /></button></div><span className="version">Vanta.vs Protector / 1.0</span></div>
    </aside>
    {mobileOpen && <button className="mobile-backdrop" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" />}
    <main className="dashboard-main">
      <header className="dashboard-header"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menú"><Menu size={19} /></button><div><span className="breadcrumb">Workspace /</span><strong>{active}</strong></div><div className="header-right"><span className="status-pill"><span /> API online</span><span className="header-user">{user?.discordUsername ? `Discord: ${user.discordUsername}` : user?.name || "Cuenta"}</span></div></header>
      <div className="dashboard-content">
        <div className="page-heading"><div><p className="overline">Workspace / Scripts</p><h1>{active === "Scripts" ? "Scripts" : active}</h1><p className="page-subtitle">Protege, aloja y controla tus scripts Lua desde un único espacio.</p></div><Button className="primary-button" onClick={() => document.getElementById("script-form")?.scrollIntoView({ behavior: "smooth" })}><Plus size={16} /> Crear script</Button></div>
        {active === "Scripts" || active === "Obfuscator" ? <>
          <section className="stats-row"><div className="stat-card"><span>Scripts alojados</span><strong>{scripts.length}</strong><small><span className="green-text">●</span> disponibles</small></div><div className="stat-card"><span>Protección</span><strong>{obfuscateSource ? "ON" : "OFF"}</strong><small>Codificación de salida</small></div><div className="stat-card"><span>Entrega</span><strong>RUNTIME</strong><small>Source no visible en web</small></div></section>
          <section className="content-grid"><div className="panel create-panel" id="script-form"><div className="panel-header"><div><h2><Terminal size={17} /> {active === "Obfuscator" ? "Obfuscate source" : "Host a script"}</h2><p>Publica una salida protegida sin exponer el código fuente.</p></div><span className="panel-index">01</span></div><div className="form-grid"><label>Script name<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mi-script.lua" /></label><label>Description <span>(optional)</span><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qué hace este script" /></label></div><label className="code-label">Paste your Luau source here<Textarea value={source} onChange={(e) => setSource(e.target.value)} placeholder="-- pega aquí tu script Lua..." spellCheck={false} /></label><div className="form-options"><label className="switch-label"><Switch checked={ffaMode} onCheckedChange={setFfaMode} /><span><strong>FFA mode</strong><small>Sin clave de licencia</small></span></label><label className="switch-label"><Switch checked={obfuscateSource} onCheckedChange={setObfuscateSource} /><span><strong>Protect source</strong><small>Entrega una salida protegida</small></span></label></div><div className="form-actions"><Button className="primary-button" onClick={createHosted} disabled={hostScript.isPending}><Link2 size={16} /> {hostScript.isPending ? "Alojando..." : "Host script"}</Button><Button variant="outline" className="secondary-button" onClick={() => setSource(exampleLua)}><FileCode2 size={16} /> Cargar ejemplo</Button></div></div><section className="panel result-panel"><div className="panel-header"><div><h2><Link2 size={17} /> Output</h2><p>{hostedResult ? "Your runtime loader is ready." : "Host a script to generate its loader."}</p></div><span className="panel-index">02</span></div>{hostedResult ? <div className="output-state"><div className="output-icon"><Check size={18} /></div><span className="success-label">HOSTED / LIVE</span><h3>{hostedResult.name}</h3><p className="private-note">La source no puede verse en el navegador. El endpoint entrega solo el artefacto en runtime.</p><div className="code-field"><span>PUBLIC URL</span><code>{hostedResult.url}</code><CopyButton value={hostedResult.url} label="Copiar URL" /></div><div className="code-field loader-field"><span>LOADER</span><code>{hostedResult.loader}</code><CopyButton value={hostedResult.loader} label="Copiar loader" /></div><div className="output-actions"><a className="text-action" href={hostedResult.url} target="_blank" rel="noreferrer">Abrir endpoint <ExternalLink size={14} /></a><button className="text-action text-button" onClick={() => downloadText(`${hostedResult.name.replace(/[^a-z0-9_-]/gi, "_")}.loader.txt`, hostedResult.loader)}><Download size={14} /> Descargar loader</button></div></div> : <div className="empty-output"><div className="empty-icon"><Link2 size={19} /></div><strong>Tu loader aparecerá aquí.</strong><span>El resultado queda listo para copiar y pegar.</span></div>}</section></section>
          <section className="panel hosted-panel"><div className="panel-header"><div><h2><FolderCode size={17} /> Hosted scripts</h2><p>Tu biblioteca de endpoints públicos.</p></div><span className="panel-index">03</span></div>{hostedQuery.isLoading ? <div className="empty-row">Cargando scripts...</div> : scripts.length === 0 ? <div className="empty-row"><FolderCode size={18} /> No scripts yet <span>— crea tu primer script arriba.</span></div> : <div className="script-list">{scripts.map((script) => <div className="script-row" key={script.id}><span className="script-file"><FileCode2 size={17} /></span><span className="script-info"><strong>{script.name}</strong><small>{script.description || "Sin descripción"} · {new Date(script.createdAt).toLocaleDateString()}</small></span><span className="ffa-tag">{script.ffaMode ? "FFA" : "KEY"}</span><code>{script.slug}</code><CopyButton value={script.loader} label="Copiar loader" /></div>)}</div>}</section>
        </> : <div className="coming-soon panel"><Code2 size={25} /><h2>{active}</h2><p>Este módulo está preparado para la siguiente iteración del workspace.</p></div>}
      </div>
    </main>
  </div>;
}
