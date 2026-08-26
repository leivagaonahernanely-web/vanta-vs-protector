import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { clearRejectedDiscordChannel, defaultSetup, getDiscordChannelUpdate, getSetupStatus, loadSetupSettings, saveSetupSettings } from "@/lib/setup";
import { validateLuaFile } from "@/lib/lua-upload";
import { getBotStatusClass, getBotStatusLabel } from "@/lib/status";
import { dashboardNavItems, getOverviewCopy } from "@/lib/dashboard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Ban, Check, Code2, Copy, Download, ExternalLink, FileCode2, FolderCode, KeyRound, LayoutDashboard, Link2, LogOut, Menu, Plus, RotateCcw, Settings2, ShieldCheck, Terminal, Trash2 } from "lucide-react";

const exampleLua = `local Players = game:GetService("Players")\n\nlocal function greet(player)\n  print("Hello, " .. player.Name)\nend\n\nPlayers.PlayerAdded:Connect(greet)`;

type HostedItem = { id: number; slug: string; name: string; description: string; ffaMode: boolean; scriptKey?: string | null; createdAt: string; url: string; loader: string };
type LicenseItem = { id: number; keyCode: string; type: "trial" | "license"; status: "active" | "revoked" | "expired"; discordUserId: string | null; hwid: string | null; expiresAt: Date | null; createdAt: Date };
type AccessRule = { id: number; kind: "user" | "role"; discordId: string; label: string | null; active: number };
type BlacklistItem = { id: number; discordUserId: string; reason: string | null; active: number };

function navIcon(kind: string) {
  if (kind === "overview") return <LayoutDashboard size={16} />;
  if (kind === "scripts") return <FolderCode size={16} />;
  if (kind === "obfuscator") return <Code2 size={16} />;
  if (kind === "keys") return <KeyRound size={16} />;
  if (kind === "hwid") return <ShieldCheck size={16} />;
  if (kind === "settings") return <Settings2 size={16} />;
  return <LayoutDashboard size={16} />;
}

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
  const [active, setActive] = useState("Overview");
  const [name, setName] = useState("mi-script.lua");
  const [description, setDescription] = useState("");
  const [scriptKey, setScriptKey] = useState("");
  const [source, setSource] = useState("");
  const [ffaMode, setFfaMode] = useState(false);
  const [obfuscateSource, setObfuscateSource] = useState(true);
  const [hostedResult, setHostedResult] = useState<HostedItem | null>(null);
  const [sourcePreview, setSourcePreview] = useState<{ id: number; name: string } | null>(null);
  const [licenseType, setLicenseType] = useState<"trial" | "license">("trial");
  const [trialDays, setTrialDays] = useState("3");
  const [blacklistId, setBlacklistId] = useState("");
  const [blacklistReason, setBlacklistReason] = useState("");
  const [ruleKind, setRuleKind] = useState<"user" | "role">("user");
  const [ruleId, setRuleId] = useState("");
  const [ruleLabel, setRuleLabel] = useState("");
  const initialSetup = typeof window === "undefined" ? defaultSetup : loadSetupSettings(localStorage);
  const [setupScript, setSetupScript] = useState(initialSetup.script);
  const [setupPermissions, setSetupPermissions] = useState(initialSetup.permissions);
  const [setupTrialDays, setSetupTrialDays] = useState(initialSetup.trialDays);
  const [setupChannel, setSetupChannel] = useState(initialSetup.channel);
  const [setupSaved, setSetupSaved] = useState(false);
  const [panelName, setPanelName] = useState("Vanta lagger");
  const [panelDescription, setPanelDescription] = useState("This control panel lets buyers redeem their key, get the script or get their role.");
  const [panelChannelId, setPanelChannelId] = useState("");
  const [panelTargetScript, setPanelTargetScript] = useState("");
  const [panelHwidHours, setPanelHwidHours] = useState("24");
  const [panelCreated, setPanelCreated] = useState(false);
  const setupStatus = getSetupStatus(setupChannel, setupSaved);
  const setupChannelValid = setupStatus.kind !== "invalid";
  const discordStatus = trpc.discord.status.useQuery(undefined, { refetchInterval: 10_000 });
  const botStatus = getBotStatusLabel({ isLoading: discordStatus.isLoading, isError: discordStatus.isError, ...discordStatus.data });
  const botStatusClass = getBotStatusClass({ isLoading: discordStatus.isLoading, isError: discordStatus.isError, ...discordStatus.data });
  const hostedQuery = trpc.hostedScripts.list.useQuery(undefined, { enabled: isAuthenticated });
  const sourceQuery = trpc.hostedScripts.source.useQuery({ id: sourcePreview?.id ?? 0 }, { enabled: Boolean(sourcePreview) && isAuthenticated });
  const providerStatus = trpc.protections.providerStatus.useQuery();
  const panelsQuery = trpc.discord.listPanels.useQuery(undefined, { enabled: isAuthenticated });
  const licensesQuery = trpc.licenseKeys.list.useQuery(undefined, { enabled: isAuthenticated });
  const blacklistQuery = trpc.access.blacklist.list.useQuery(undefined, { enabled: isAuthenticated });
  const whitelistQuery = trpc.access.whitelist.list.useQuery(undefined, { enabled: isAuthenticated });
  const generateLicense = trpc.licenseKeys.generate.useMutation({ onSuccess: () => { void licensesQuery.refetch(); toast.success(licenseType === "trial" ? "Trial generado" : "Key generada"); }, onError: (e) => toast.error(e.message) });
  const revokeLicense = trpc.licenseKeys.revoke.useMutation({ onSuccess: () => { void licensesQuery.refetch(); toast.success("Key revocada"); } });
  const deleteLicense = trpc.licenseKeys.remove.useMutation({ onSuccess: () => { void licensesQuery.refetch(); toast.success("Key eliminada"); } });
  const resetHwid = trpc.licenseKeys.resetHwid.useMutation({ onSuccess: () => { void licensesQuery.refetch(); toast.success("HWID reiniciado"); } });
  const addBlacklist = trpc.access.blacklist.add.useMutation({ onSuccess: () => { setBlacklistId(""); setBlacklistReason(""); void blacklistQuery.refetch(); toast.success("Usuario bloqueado"); }, onError: (e) => toast.error(e.message) });
  const removeBlacklist = trpc.access.blacklist.remove.useMutation({ onSuccess: () => { void blacklistQuery.refetch(); toast.success("Blacklist actualizada"); } });
  const addWhitelist = trpc.access.whitelist.add.useMutation({ onSuccess: () => { setRuleId(""); setRuleLabel(""); void whitelistQuery.refetch(); toast.success("Whitelist actualizada"); }, onError: (e) => toast.error(e.message) });
  const removeWhitelist = trpc.access.whitelist.remove.useMutation({ onSuccess: () => { void whitelistQuery.refetch(); toast.success("Whitelist actualizada"); } });
  const updateDiscordChannel = trpc.discord.updateChannel.useMutation({ onSuccess: () => { setSetupSaved(true); toast.success("Canal Discord guardado"); }, onError: (error) => { setSetupSaved(false); const cleared = clearRejectedDiscordChannel(localStorage, { script: setupScript, permissions: setupPermissions, trialDays: setupTrialDays, channel: setupChannel }); setSetupChannel(cleared.channel); toast.error(error.message); } });
  const createDiscordPanel = trpc.discord.createPanel.useMutation({ onSuccess: () => { setPanelCreated(true); void panelsQuery.refetch(); toast.success("Panel publicado en Discord"); }, onError: (error) => toast.error(error.message) });
  const deleteDiscordPanel = trpc.discord.deletePanel.useMutation({ onSuccess: () => { void panelsQuery.refetch(); toast.success("Panel eliminado"); }, onError: (error) => toast.error(error.message) });
  const republishDiscordPanel = trpc.discord.republishPanel.useMutation({ onSuccess: () => { void panelsQuery.refetch(); toast.success("Panel republicado"); }, onError: (error) => toast.error(error.message) });
  const hostScript = trpc.hostedScripts.create.useMutation({
    onSuccess: (item) => { setHostedResult(item); setSource(""); void hostedQuery.refetch(); toast.success("Script alojado"); },
    onError: (error) => toast.error(error.message || "No se pudo alojar el script"),
  });

  function createHosted() {
    if (!source.trim()) { toast.error("Pega el código Lua antes de alojarlo"); return; }
    hostScript.mutate({ name, description: description || undefined, scriptKey: scriptKey || undefined, source, ffaMode, obfuscateSource });
  }
  function loadLuaFile(file?: File) {
    if (!file) return;
    const validationError = validateLuaFile(file);
    if (validationError) { toast.error(validationError); return; }
    file.text().then(setSource).catch(() => toast.error("No se pudo leer el archivo Lua"));
  }
  function connectDiscord() { window.location.assign(`/api/discord/start?origin=${encodeURIComponent(window.location.origin)}`); }
  function selectNav(item: string) { setActive(item); setMobileOpen(false); }
  function generateKey() { generateLicense.mutate({ type: licenseType, trialDays: Number(trialDays) }); }
  function createPanel() {
    if (!panelChannelId || !panelTargetScript) { toast.error("Indica el canal y el script objetivo"); return; }
    createDiscordPanel.mutate({ name: panelName, description: panelDescription || undefined, channelId: panelChannelId, targetScript: panelTargetScript, hwidHours: Number(panelHwidHours) || 24 });
  }
  function saveSetup() {
    if (!setupChannelValid) { toast.error("El ID del canal debe tener entre 15 y 22 dígitos"); return; }
    setSetupSaved(false);
    saveSetupSettings(localStorage, { script: setupScript, permissions: setupPermissions, trialDays: setupTrialDays, channel: setupChannel });
    updateDiscordChannel.mutate(getDiscordChannelUpdate(setupChannel));
  }
  const licenses = (licensesQuery.data ?? []) as LicenseItem[];
  const blacklist = (blacklistQuery.data ?? []) as BlacklistItem[];
  const whitelist = (whitelistQuery.data ?? []) as AccessRule[];

  if (loading) return <div className="auth-screen"><div className="auth-card"><div className="auth-icon"><Code2 size={19} /></div><div className="skeleton-line" /><div className="skeleton-line short" /></div></div>;

  if (!isAuthenticated) return <div className="auth-screen"><div className="auth-card"><div className="auth-icon"><Code2 size={20} /></div><h1>Inicia sesión para continuar</h1><p>Accede a tu workspace para proteger y alojar tus scripts Lua.</p><Button className="primary-button full-button" onClick={() => startLogin()}>Continuar con acceso <ExternalLink size={15} /></Button><div className="auth-foot"><span>Vanta.vs Protector</span><span>Secure workspace</span></div></div><span className="made-by">Built for controlled delivery</span></div>;

  const scripts = (hostedQuery.data ?? []) as HostedItem[];
  const overviewCopy = getOverviewCopy();
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
      <div className="sidebar-brand"><span className="brand-symbol"><ShieldCheck size={18} /></span><span><strong>Vanta.vs</strong><small>Protector</small></span></div>
      <div className="workspace-switch"><span className="workspace-dot" /> <span>Personal workspace</span><span className="chevron">⌄</span></div>
      <nav className="side-nav">
        {(["Workspace", "Protection", "Panels", "Settings"] as const).map((group) => <div key={group}>
          <p className="nav-label">{group}</p>
          {dashboardNavItems.filter((item) => item.group === group).map((item) => <button key={item.label} className={active === item.label ? "active" : ""} onClick={() => selectNav(item.label)}>{navIcon(item.icon)} {item.label === "License keys" ? "Generate / Manage" : item.label}{item.badge === "scripts" && <span className="nav-badge">{scripts.length}</span>}</button>)}
        </div>)}
        <button onClick={connectDiscord}><Link2 size={16} /> {user?.discordUsername ? "Discord conectado" : "Conectar Discord"}</button>
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-user"><span className="avatar">{user?.discordAvatarUrl ? <img src={user.discordAvatarUrl} alt="Avatar Discord" /> : (user?.name || "V").slice(0, 1).toUpperCase()}</span><span><strong>{user?.discordUsername || user?.name || "Cuenta"}</strong><small>{user?.discordNickname ? `Apodo: ${user.discordNickname} · ` : ""}{user?.discordUserId ? `ID: ${user.discordUserId}` : user?.email || "Discord no vinculado"}</small></span><button onClick={() => logout()} aria-label="Cerrar sesión"><LogOut size={15} /></button></div><span className="version">Vanta.vs Protector / 1.0</span></div>
    </aside>
    {mobileOpen && <button className="mobile-backdrop" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" />}
    <main className="dashboard-main">
      <header className="dashboard-header"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menú"><Menu size={19} /></button><div><span className="breadcrumb">Workspace /</span><strong>{active}</strong></div><div className="header-right"><span className={`status-pill ${botStatusClass}`}><span /> {botStatus}</span><span className="header-user">{user?.discordUsername ? `Discord: ${user.discordUsername}` : user?.name || "Cuenta"}</span></div></header>
      <div className="dashboard-content">
        <div className="page-heading"><div><p className="overline">Workspace / {active}</p><h1>{active === "Scripts" ? "Scripts" : active}</h1><p className="page-subtitle">{active === "Overview" ? "Protección, alojamiento y control de acceso para scripts Lua." : "Gestiona esta sección desde tu workspace privado."}</p></div>{(active === "Scripts" || active === "Obfuscator") && <Button className="primary-button" onClick={() => document.getElementById("script-form")?.scrollIntoView({ behavior: "smooth" })}><Plus size={16} /> Crear script</Button>}</div>
        {active === "Overview" ? <section className="overview-panel panel"><div className="panel-header"><div><h2><ShieldCheck size={17} /> {overviewCopy.title}</h2><p>{overviewCopy.description}</p></div><span className="panel-index">00</span></div><div className="overview-copy"><p>{overviewCopy.title} ayuda a alojar artefactos protegidos, generar loaders públicos y administrar accesos mediante licencias, whitelist, blacklist y HWID.</p><div className="overview-grid"><div><strong>Protege</strong><span>Transforma la salida y mantiene la source original privada.</span></div><div><strong>Aloja</strong><span>Entrega un loader estable para ejecución en runtime.</span></div><div><strong>Controla</strong><span>Gestiona keys, trials, roles y accesos desde el workspace.</span></div></div></div></section> : active === "Scripts" || active === "Obfuscator" ? <>
          <section className="stats-row"><div className="stat-card"><span>Scripts alojados</span><strong>{scripts.length}</strong><small><span className="green-text">●</span> disponibles</small></div><div className="stat-card"><span>Protección</span><strong>{providerStatus.data?.adapter.official ? "OFFICIAL" : "LOCAL"}</strong><small>{providerStatus.data?.adapter.provider || "runtime wrapper"} · {obfuscateSource ? "ON" : "OFF"}</small></div><div className="stat-card"><span>Entrega</span><strong>RUNTIME</strong><small>Source no visible en web</small></div></section>
          <section className="content-grid"><div className="panel create-panel" id="script-form"><div className="panel-header"><div><h2><Terminal size={17} /> {active === "Obfuscator" ? "Obfuscate source" : "Host a script"}</h2><p>Publica una salida protegida sin exponer el código fuente.</p></div><span className="panel-index">01</span></div><div className="form-grid"><label>Script name<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mi-script.lua" /></label><label>Description <span>(optional)</span><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qué hace este script" /></label><label>Script key <span>(optional)</span><Input value={scriptKey} onChange={(e) => setScriptKey(e.target.value)} placeholder="clave-runtime" /></label></div><label className="code-label">Paste your Luau source here<div className="file-upload-row"><input type="file" accept=".lua,text/plain" onChange={(e) => loadLuaFile(e.target.files?.[0])} aria-label="Cargar archivo Lua" /><span>Solo tú controlas la source desde este panel privado.</span></div><Textarea value={source} onChange={(e) => setSource(e.target.value)} placeholder="-- pega aquí tu script Lua..." spellCheck={false} /></label><div className="form-options"><label className="switch-label"><Switch checked={ffaMode} onCheckedChange={setFfaMode} /><span><strong>FFA mode</strong><small>Sin clave de licencia</small></span></label><label className="switch-label"><Switch checked={obfuscateSource} onCheckedChange={setObfuscateSource} /><span><strong>Protect source</strong><small>Entrega una salida protegida</small></span></label></div><div className="form-actions"><Button className="primary-button" onClick={createHosted} disabled={hostScript.isPending}><Link2 size={16} /> {hostScript.isPending ? "Alojando..." : "Host script"}</Button><Button variant="outline" className="secondary-button" onClick={() => setSource(exampleLua)}><FileCode2 size={16} /> Cargar ejemplo</Button></div></div><section className="panel result-panel"><div className="panel-header"><div><h2><Link2 size={17} /> Output</h2><p>{hostedResult ? "Your runtime loader is ready." : "Host a script to generate its loader."}</p></div><span className="panel-index">02</span></div>{hostedResult ? <div className="output-state"><div className="output-icon"><Check size={18} /></div><span className="success-label">HOSTED / LIVE</span><h3>{hostedResult.name}</h3><p className="private-note">La source no puede verse en el navegador. El endpoint entrega solo el artefacto en runtime.</p><div className="code-field"><span>PUBLIC URL</span><code>{hostedResult.url}</code><CopyButton value={hostedResult.url} label="Copiar URL" /></div><div className="code-field loader-field"><span>LOADER</span><code>{hostedResult.loader}</code><CopyButton value={hostedResult.loader} label="Copiar loader" /></div><div className="output-actions"><a className="text-action" href={hostedResult.url} target="_blank" rel="noreferrer">Abrir endpoint <ExternalLink size={14} /></a><button className="text-action text-button" onClick={() => downloadText(`${hostedResult.name.replace(/[^a-z0-9_-]/gi, "_")}.loader.txt`, hostedResult.loader)}><Download size={14} /> Descargar loader</button></div></div> : <div className="empty-output"><div className="empty-icon"><Link2 size={19} /></div><strong>Tu loader aparecerá aquí.</strong><span>El resultado queda listo para copiar y pegar.</span></div>}</section></section>
          <section className="panel hosted-panel"><div className="panel-header"><div><h2><FolderCode size={17} /> Hosted scripts</h2><p>Tu biblioteca de endpoints públicos.</p></div><span className="panel-index">03</span></div>{hostedQuery.isLoading ? <div className="empty-row">Cargando scripts...</div> : scripts.length === 0 ? <div className="empty-row"><FolderCode size={18} /> No scripts yet <span>— crea tu primer script arriba.</span></div> : <div className="script-list">{scripts.map((script) => <div className="script-row" key={script.id}><span className="script-file"><FileCode2 size={17} /></span><span className="script-info"><strong>{script.name}</strong><small>{script.description || "Sin descripción"} · {new Date(script.createdAt).toLocaleDateString()}</small></span><span className="ffa-tag">{script.ffaMode ? "FFA" : "KEY"}</span><code>{script.slug}</code><CopyButton value={script.loader} label="Copiar loader" /><button className="text-action text-button" onClick={() => setSourcePreview({ id: script.id, name: script.name })}>View source</button></div>)}</div>}</section>{sourcePreview && <section className="panel source-panel"><div className="panel-header"><div><h2><Code2 size={17} /> Private source</h2><p>Visible únicamente para el propietario autenticado; nunca se entrega desde la URL pública.</p></div><button className="text-action text-button" onClick={() => setSourcePreview(null)}>Cerrar</button></div>{sourceQuery.isLoading ? <div className="empty-row">Cargando source privada...</div> : <pre className="source-preview">{sourceQuery.data?.code || "No se pudo cargar la source."}</pre>}</section>}
        </> : active === "License keys" ? <section className="panel manager-panel"><div className="panel-header"><div><h2><KeyRound size={17} /> License keys</h2><p>Genera trials o keys permanentes de 10 dígitos.</p></div><span className="panel-index">04</span></div><div className="manager-toolbar"><div className="segmented"><button className={licenseType === "trial" ? "selected" : ""} onClick={() => setLicenseType("trial")}>TRIAL</button><button className={licenseType === "license" ? "selected" : ""} onClick={() => setLicenseType("license")}>LICENSE</button></div>{licenseType === "trial" && <label>Días<Input value={trialDays} onChange={(e) => setTrialDays(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></label>}<Button className="primary-button" onClick={generateKey} disabled={generateLicense.isPending}><Plus size={15} /> {generateLicense.isPending ? "Generando..." : "Generate key"}</Button></div><div className="license-list">{licenses.length === 0 ? <div className="empty-row"><KeyRound size={17} /> Todavía no hay licencias.</div> : licenses.map((license) => <div className="license-row" key={license.id}><code>{license.keyCode}</code><span className={license.type === "trial" ? "ffa-tag" : "license-tag"}>{license.type === "trial" ? "TRIAL" : "KEY"}</span><span className="license-status">{license.status}</span><small>{license.expiresAt ? `Expira ${new Date(license.expiresAt).toLocaleDateString()}` : "Sin vencimiento"}</small><button className="row-action" onClick={() => resetHwid.mutate({ id: license.id })} title="Reset HWID"><RotateCcw size={14} /></button><button className="row-action danger" onClick={() => deleteLicense.mutate({ id: license.id })} title="Delete key"><Trash2 size={14} /></button></div>)}</div></section> : active === "HWID bans" ? <section className="panel manager-panel"><div className="panel-header"><div><h2><Ban size={17} /> HWID bans / Blacklist</h2><p>Bloquea usuarios de Discord por ID y conserva el motivo.</p></div><span className="panel-index">05</span></div><div className="manager-form"><Input value={blacklistId} onChange={(e) => setBlacklistId(e.target.value)} placeholder="Discord user ID (15–22 dígitos)" /><Input value={blacklistReason} onChange={(e) => setBlacklistReason(e.target.value)} placeholder="Motivo opcional" /><Button className="primary-button" onClick={() => blacklistId && addBlacklist.mutate({ discordUserId: blacklistId, reason: blacklistReason || undefined })}><Ban size={15} /> Blacklist user</Button></div><div className="license-list">{blacklist.length === 0 ? <div className="empty-row">No hay usuarios bloqueados.</div> : blacklist.map((item) => <div className="license-row" key={item.id}><code>{item.discordUserId}</code><span className="danger-tag">BLOCKED</span><small>{item.reason || "Sin motivo"}</small><button className="row-action" onClick={() => removeBlacklist.mutate({ id: item.id })} title="Remove blacklist"><Trash2 size={14} /></button></div>)}</div></section> : active === "Create New Panel" ? <section className="panel manager-panel"><div className="panel-header"><div><h2><LayoutDashboard size={17} /> Create New Panel</h2><p>Publica un panel Discord con la configuración de tu script.</p></div><span className="panel-index">06</span></div><div className="form-grid"><label>Name script<Input value={panelName} onChange={(e) => setPanelName(e.target.value)} placeholder="Vanta lagger" /></label><label>Panel channel ID<Input value={panelChannelId} onChange={(e) => setPanelChannelId(e.target.value.replace(/\\D/g, ""))} placeholder="ID de canal (15–22 dígitos)" inputMode="numeric" /></label><label className="wide-field">Description script<Input value={panelDescription} onChange={(e) => setPanelDescription(e.target.value)} placeholder="Descripción que verá el comprador" /></label><label>Target script<select value={panelTargetScript} onChange={(e) => setPanelTargetScript(e.target.value)}><option value="">Select script</option>{scripts.map((script) => <option key={script.id} value={script.name}>{script.name}</option>)}</select></label><label>HWID countdown (hours)<Input value={panelHwidHours} onChange={(e) => setPanelHwidHours(e.target.value.replace(/\\D/g, ""))} inputMode="numeric" /></label></div><div className="setup-actions"><span className={`setup-status ${panelCreated ? "saved" : ""}`}>{panelCreated ? "Panel publicado" : "Listo para publicar"}</span><Button className="primary-button" onClick={createPanel} disabled={createDiscordPanel.isPending}><LayoutDashboard size={15} /> {createDiscordPanel.isPending ? "Publicando..." : "+ CREATE PANEL"}</Button></div></section> : active === "Setup" ? <section className="panel manager-panel"><div className="panel-header"><div><h2><Settings2 size={17} /> Setup / Control center</h2><p>Configura script, permisos, trial, canal Discord y whitelist desde un solo lugar.</p></div><span className="panel-index">06</span></div><div className="setup-config"><div className="setup-config-heading"><strong>Runtime configuration</strong><span>Se guarda en este workspace</span></div><div className="form-grid"><label>Script por defecto<Input value={setupScript} onChange={(e) => setSetupScript(e.target.value)} placeholder="mi-script.lua" /></label><label>Trial (días)<Input value={setupTrialDays} onChange={(e) => setSetupTrialDays(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></label><label className="wide-field">Permisos del bot<Input value={setupPermissions} onChange={(e) => setSetupPermissions(e.target.value)} placeholder="View Channels, Send Messages" /></label><label className="wide-field">Canal Discord<Input value={setupChannel} onChange={(e) => setSetupChannel(e.target.value.replace(/\D/g, ""))} placeholder="ID de canal (15–22 dígitos)" inputMode="numeric" /></label></div><div className="setup-actions"><span className={`setup-status ${setupStatus.kind === "saved" ? "saved" : setupStatus.kind === "invalid" ? "invalid" : ""}`}>{setupStatus.label}</span><Button className="primary-button" onClick={saveSetup} disabled={updateDiscordChannel.isPending}><Settings2 size={15} /> {updateDiscordChannel.isPending ? "Guardando..." : "Guardar setup"}</Button></div></div><div className="manager-form"><div className="segmented"><button className={ruleKind === "user" ? "selected" : ""} onClick={() => setRuleKind("user")}>USER</button><button className={ruleKind === "role" ? "selected" : ""} onClick={() => setRuleKind("role")}>ROLE</button></div><Input value={ruleId} onChange={(e) => setRuleId(e.target.value)} placeholder="Discord ID (15–22 dígitos)" /><Input value={ruleLabel} onChange={(e) => setRuleLabel(e.target.value)} placeholder="Nombre visible opcional" /><Button className="primary-button" onClick={() => ruleId && addWhitelist.mutate({ kind: ruleKind, discordId: ruleId, label: ruleLabel || undefined })}><Plus size={15} /> Add to whitelist</Button></div><div className="license-list">{whitelist.length === 0 ? <div className="empty-row">Aún no hay reglas whitelist.</div> : whitelist.map((rule) => <div className="license-row" key={rule.id}><span className="license-tag">{rule.kind.toUpperCase()}</span><code>{rule.discordId}</code><small>{rule.label || "Sin etiqueta"}</small><button className="row-action" onClick={() => removeWhitelist.mutate({ id: rule.id })} title="Remove whitelist"><Trash2 size={14} /></button></div>)}</div></section> : active === "Manage Panels" ? <section className="panel manager-panel"><div className="panel-header"><div><h2><LayoutDashboard size={17} /> Manage Panels</h2><p>Paneles publicados. Acciones disponibles: republicar o eliminar.</p></div><span className="panel-index">07</span></div>{panelsQuery.isLoading ? <div className="empty-row">Cargando paneles...</div> : panelsQuery.data?.length ? <div className="license-list">{panelsQuery.data.map((panel) => <div className="license-row" key={panel.id}><span className="license-tag">PANEL</span><strong>{panel.name}</strong><small>{panel.targetScript} · canal {panel.channelId} · HWID {panel.hwidHours}h</small><code>{panel.messageId || "sin mensaje"}</code><button className="row-action" onClick={() => republishDiscordPanel.mutate({ id: panel.id })} title="Republicar panel"><RotateCcw size={14} /></button><button className="row-action danger" onClick={() => deleteDiscordPanel.mutate({ id: panel.id })} title="Eliminar panel"><Trash2 size={14} /></button></div>)}</div> : <div className="empty-row"><LayoutDashboard size={17} /> Aún no hay paneles publicados. Usa Create New Panel.</div>}</section> : <div className="coming-soon panel"><Code2 size={25} /><h2>{active}</h2><p>Este módulo está preparado para la siguiente iteración del workspace.</p></div>}
      </div>
    </main>
  </div>;
}
