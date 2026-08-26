import { useMemo, useState } from "react";
import { ArrowDown, ArrowRight, Check, Clipboard, Code2, Download, FileCode2, LockKeyhole, LogIn, Menu, ShieldCheck, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";

const starterCode = `local function greet(name)\n  return "Hola, " .. name\nend\n\nprint(greet("Vanta"))`;

const modes = [
  { value: "fast", label: "Rápido", description: "Envoltura ligera para pruebas." },
  { value: "balanced", label: "Equilibrado", description: "Protección práctica para uso diario." },
  { value: "fortified", label: "Fortificado", description: "Más capas y revisión recomendada." },
] as const;

type Mode = (typeof modes)[number]["value"];
type Result = { id: number | null; name: string; status: "protected" | "review" | "failed"; checksum: string; code: string; createdAt: string; message: string };

function StatusMark({ status }: { status: Result["status"] }) {
  const label = status === "protected" ? "PROTEGIDO" : status === "review" ? "REVISIÓN" : "FALLÓ";
  const tone = status === "protected" ? "status-good" : status === "review" ? "status-review" : "status-failed";
  return <span className={`status-mark ${tone}`}><span className="status-dot" />{label}</span>;
}

export default function Home() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [code, setCode] = useState("");
  const [scriptName, setScriptName] = useState("mi-script.lua");
  const [mode, setMode] = useState<Mode>("balanced");
  const [obfuscateStrings, setObfuscateStrings] = useState(true);
  const [addLoaderGuard, setAddLoaderGuard] = useState(true);
  const [discordChannelId, setDiscordChannelId] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [activeView, setActiveView] = useState<"protect" | "activity">("protect");

  const historyQuery = trpc.protections.history.useQuery(undefined, { enabled: isAuthenticated });
  const createProtection = trpc.protections.create.useMutation({
    onSuccess: (payload) => {
      setResult(payload);
      setActiveView("protect");
      void historyQuery.refetch();
      toast.success(payload.status === "review" ? "Protección creada; requiere revisión." : "Script protegido correctamente.");
    },
    onError: (error) => toast.error(error.message || "No pudimos proteger el script."),
  });

  const codeSize = useMemo(() => new Blob([code]).size, [code]);
  const currentMode = modes.find((item) => item.value === mode) ?? modes[1];

  function handleProtect() {
    if (!isAuthenticated) { startLogin(); return; }
    if (!code.trim()) { toast.error("Pega un script Lua antes de continuar."); return; }
    createProtection.mutate({ name: scriptName.trim() || "mi-script.lua", source: code, mode, obfuscateStrings, addLoaderGuard, discordChannelId: discordChannelId.trim() || undefined });
  }

  function copyResult() {
    if (!result) return;
    void navigator.clipboard.writeText(result.code).then(() => toast.success("Resultado copiado al portapapeles."));
  }

  function downloadResult() {
    if (!result) return;
    const blob = new Blob([result.code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${result.name.replace(/\.lua$/i, "")}.vanta.lua`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Descarga preparada.");
  }

  function scrollToPanel() { document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" }); }
  function connectDiscord() { window.location.assign(`/api/discord/start?origin=${encodeURIComponent(window.location.origin)}`); }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Vanta.vs Protector, inicio"><span className="brand-mark"><ShieldCheck size={20} strokeWidth={2.5} /></span><span>Vanta.vs Protector</span></a>
        <nav className={`site-nav ${mobileOpen ? "site-nav-open" : ""}`} aria-label="Navegación principal"><a href="#how-it-works" onClick={() => setMobileOpen(false)}>Cómo funciona</a><a href="#security" onClick={() => setMobileOpen(false)}>Seguridad</a><a href="#workspace" onClick={() => { setMobileOpen(false); scrollToPanel(); }}>Proteger script</a></nav>
        <div className="header-actions">{isAuthenticated ? <><button className="user-pill" onClick={() => setActiveView("activity")} aria-label="Abrir actividad de usuario"><span className="user-avatar">{(user?.name || "V").slice(0, 1).toUpperCase()}</span><span className="user-name">{user?.name || "Cuenta"}</span></button><Button variant="ghost" className="login-button" onClick={connectDiscord}>{user?.discordUsername ? "Discord conectado" : "Conectar Discord"}</Button></> : <Button variant="ghost" className="login-button" onClick={() => startLogin()}><LogIn size={16} /> Acceder</Button>}<button className="menu-toggle" aria-label="Abrir menú" onClick={() => setMobileOpen((open) => !open)}>{mobileOpen ? <X size={22} /> : <Menu size={22} />}</button></div>
      </header>

      <main id="top">
        <section className="hero-section container"><div className="hero-copy reveal-up"><p className="eyebrow"><span className="eyebrow-line" /> PROTECCIÓN LUA / 01</p><h1>Tu código.<br /><span>Tu control.</span></h1><p className="hero-lede">Protege tus scripts Lua con una capa de control clara, rápida y lista para usar. Menos exposición. Más intención.</p><div className="hero-cta-row"><Button className="button-red button-large" onClick={scrollToPanel}>Empezar a proteger <ArrowRight size={18} /></Button><a className="text-link" href="#how-it-works">Ver el flujo <ArrowDown size={15} /></a></div><div className="hero-proof"><span className="proof-check"><Check size={14} /></span> El secreto de integración nunca llega al navegador.</div></div><div className="hero-frame reveal-up delay-1" aria-label="Vista previa abstracta de código protegido"><div className="frame-topline"><span>VANTA / RUNTIME</span><span className="live-label"><span /> ACTIVE</span></div><div className="frame-body"><div className="frame-number">001</div><div className="frame-code"><span className="code-muted">local</span> <span className="code-bright">__vanta</span> = <span className="code-red">Protector</span>.<span className="code-bright">new</span>()<br /><span className="code-muted">local</span> payload = <span className="code-orange">"••••••••••••••••"</span><br /><span className="code-muted">return</span> __vanta:<span className="code-bright">run</span>(payload)</div></div><div className="frame-bottomline"><span>SHA / 8F4C-2A19</span><span>SECURE LOAD</span></div></div></section>

        <div className="red-divider" aria-hidden="true"><span>VANTA.VS / PROTECTOR</span><span>BUILT FOR CONTROL</span></div>

        <section id="how-it-works" className="manifesto-section container"><div className="section-kicker">02 / EL FLUJO</div><div className="manifesto-grid"><h2>Protección sin<br /><em>ruido.</em></h2><div className="manifesto-copy"><p>Una herramienta directa para convertir tu script fuente en un artefacto protegido, con opciones visibles y un resultado que puedes inspeccionar antes de descargar.</p><a className="arrow-link" href="#workspace">Abrir el panel <ArrowRight size={15} /></a></div></div><div className="steps-grid"><article className="step-card"><span>01</span><Code2 size={22} /><h3>Pega el código</h3><p>Trabaja desde tu editor habitual. El servidor recibe el contenido solo durante la protección.</p></article><article className="step-card"><span>02</span><LockKeyhole size={22} /><h3>Elige el nivel</h3><p>Controla la intensidad del flujo y las capas visibles antes de ejecutar.</p></article><article className="step-card"><span>03</span><FileCode2 size={22} /><h3>Obtén el resultado</h3><p>Previsualiza, copia o descarga tu archivo con un checksum de referencia.</p></article></div></section>

        <section id="workspace" className="workspace-section"><div className="container"><div className="workspace-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> WORKSPACE / {isAuthenticated ? "SIGNED IN" : "PREVIEW MODE"}</p><h2>Protege tu script.</h2></div>{isAuthenticated && <div className="view-switcher" role="tablist"><button className={activeView === "protect" ? "active" : ""} onClick={() => setActiveView("protect")}>Nueva protección</button><button className={activeView === "activity" ? "active" : ""} onClick={() => setActiveView("activity")}>Actividad</button></div>}</div>{isAuthenticated && <div className="discord-identity"><div><p className="panel-label">IDENTIDAD DISCORD</p><strong>{user?.discordUsername ? `Conectado como ${user.discordUsername}` : "Discord aún no está conectado"}</strong>{user?.discordUserId && <small>ID / {user.discordUserId}</small>}</div>{!user?.discordUsername && <Button className="button-red" onClick={connectDiscord}>Conectar Discord <ArrowRight size={15} /></Button>}</div>}{!isAuthenticated && !authLoading && <div className="access-banner"><div><strong>Accede para guardar tu actividad.</strong><span> Puedes probar el flujo aquí y luego iniciar sesión para conservar tus resultados.</span></div><Button className="button-white" onClick={() => startLogin()}>Acceder con Manus <ArrowRight size={16} /></Button></div>}

          {activeView === "activity" && isAuthenticated ? <section className="activity-panel" aria-label="Historial de protecciones"><div className="activity-head"><div><p className="panel-label">REGISTRO DE CUENTA</p><h3>Actividad reciente</h3></div><span className="activity-count">{historyQuery.data?.length ?? 0} registros</span></div>{historyQuery.isLoading ? <div className="empty-state">Cargando actividad…</div> : historyQuery.data?.length ? <div className="activity-list">{historyQuery.data.map((item) => <button key={item.id} className="activity-row" onClick={() => { setResult(item); setActiveView("protect"); }}><span className="activity-icon"><FileCode2 size={16} /></span><span className="activity-name"><strong>{item.name}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></span><StatusMark status={item.status as Result["status"]} /><span className="activity-checksum">{item.checksum}</span><ArrowRight size={16} /></button>)}</div> : <div className="empty-state"><Sparkles size={20} />Todavía no tienes protecciones guardadas.</div>}</section> : <div className="workspace-grid"><Card className="editor-card"><CardHeader className="editor-header"><div><p className="panel-label">ENTRADA / LUA</p><CardTitle>Fuente del script</CardTitle></div><Badge className="editor-badge">{codeSize.toLocaleString()} bytes</Badge></CardHeader><CardContent><div className="field-row"><div className="field-grow"><Label htmlFor="script-name">Nombre del archivo</Label><Input id="script-name" value={scriptName} onChange={(event) => setScriptName(event.target.value)} placeholder="mi-script.lua" /></div><Button variant="outline" className="load-example" onClick={() => setCode(starterCode)}>Cargar ejemplo</Button></div><Textarea id="lua-source" value={code} onChange={(event) => setCode(event.target.value)} placeholder="-- Pega aquí tu script Lua…" className="code-textarea" spellCheck={false} /><div className="editor-footer"><span><span className="editor-status-dot" /> listo para recibir</span><span>Lua / UTF-8</span></div></CardContent></Card>

          <Card className="options-card"><CardHeader><p className="panel-label">CONFIGURACIÓN / 02</p><CardTitle>Capas visibles</CardTitle></CardHeader><CardContent><div className="mode-list">{modes.map((item) => <button key={item.value} className={`mode-option ${mode === item.value ? "selected" : ""}`} onClick={() => setMode(item.value)}><span className="mode-radio" /><span><strong>{item.label}</strong><small>{item.description}</small></span></button>)}</div><div className="toggle-list"><label className="toggle-row"><span><strong>Ofuscar strings</strong><small>Codifica el contenido de texto.</small></span><Switch checked={obfuscateStrings} onCheckedChange={setObfuscateStrings} /></label><label className="toggle-row"><span><strong>Loader guard</strong><small>Añade una validación de carga.</small></span><Switch checked={addLoaderGuard} onCheckedChange={setAddLoaderGuard} /></label></div><div className="selected-mode"><span>Nivel seleccionado</span><strong>{currentMode.label.toUpperCase()}</strong></div><div className="channel-field"><Label htmlFor="discord-channel">Canal Discord para avisos <span>(opcional)</span></Label><Input id="discord-channel" value={discordChannelId} onChange={(event) => setDiscordChannelId(event.target.value.replace(/\D/g, ""))} placeholder="ID numérico del canal" inputMode="numeric" /><small>El bot debe estar dentro del servidor y tener permiso para enviar mensajes.</small></div><Button className="button-red protect-button" onClick={handleProtect} disabled={createProtection.isPending}>{createProtection.isPending ? "Protegiendo…" : isAuthenticated ? "Proteger script" : "Acceder y proteger"}<ArrowRight size={17} /></Button></CardContent></Card>

          <Card className="result-card"><CardHeader><div><p className="panel-label">SALIDA / 03</p><CardTitle>Resultado</CardTitle></div>{result && <StatusMark status={result.status} />}</CardHeader><CardContent>{result ? <><div className="result-meta"><span>{result.name}</span><span>SHA / {result.checksum}</span></div>{result.status === "review" && <div className="review-note">Este resultado quedó marcado para revisión por su patrón de carga. Puedes previsualizarlo y descargarlo mientras el propietario recibe una notificación.</div>}<pre className="result-preview"><code>{result.code}</code></pre><div className="result-actions"><Button variant="outline" onClick={copyResult}><Clipboard size={16} /> Copiar</Button><Button className="button-white" onClick={downloadResult}><Download size={16} /> Descargar</Button></div></> : <div className="result-empty"><div className="result-empty-icon"><FileCode2 size={25} /></div><strong>Tu salida aparecerá aquí.</strong><span>El estado, el checksum y el código protegido quedarán visibles antes de descargar.</span></div>}</CardContent></Card></div>}
        </div></section>

        <section id="security" className="security-section container"><div className="security-copy"><p className="eyebrow"><span className="eyebrow-line" /> 04 / CONTROL DEL SERVIDOR</p><h2>La integración vive<br /><span>del otro lado.</span></h2><p>Las credenciales de la integración se mantienen en variables de entorno del servidor. La interfaz recibe estados y resultados; nunca recibe el secreto.</p></div><div className="security-specs"><div><span>01</span><strong>SOLO SERVIDOR</strong><small>Client ID y Client Secret no se incluyen en el bundle web.</small></div><div><span>02</span><strong>REGISTRO POR USUARIO</strong><small>Cada registro queda asociado a la cuenta que inició la protección.</small></div><div><span>03</span><strong>AVISOS AL PROPIETARIO</strong><small>Los fallos y revisiones activan una notificación operativa.</small></div></div></section>
      </main>

      <footer className="site-footer container"><div className="footer-brand"><span className="brand-mark"><ShieldCheck size={18} /></span><strong>Vanta.vs Protector</strong></div><span>Protección Lua enfocada en el control.</span><span>© 2026 Vanta.vs</span></footer>
    </div>
  );
}
