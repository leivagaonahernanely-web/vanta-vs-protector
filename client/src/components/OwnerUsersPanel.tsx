import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, UserCog, UserRoundCheck, UserRoundX } from "lucide-react";
import { toast } from "sonner";

type ManagedUser = {
  id: number;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
  plan: "free" | "pro" | "premium";
  webAccess: number;
  discordUserId: string | null;
  discordUsername: string | null;
  discordNickname: string | null;
  discordAvatarUrl: string | null;
  createdAt: string;
  lastSignedIn: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function OwnerUsersPanel() {
  const { user } = useAuth();
  const query = trpc.owner.users.useQuery(undefined, { enabled: user?.isOwner === true, refetchOnMount: "always" });
  const update = trpc.owner.updateUser.useMutation({
    onSuccess: () => { void query.refetch(); toast.success("Usuario actualizado"); },
    onError: (error) => toast.error(error.message),
  });
  const users = (query.data ?? []) as ManagedUser[];

  return <section className="panel manager-panel owner-users-panel">
    <div className="panel-header">
      <div><span className="overline">OWNER ONLY</span><h2><UserCog size={17} /> Users web</h2><p>Usuarios de Discord que han iniciado sesión en Vantaprotect. Solo tú puedes ver y administrar esta sección.</p></div>
      <span className="panel-index">USERS</span>
    </div>
    <div className="users-summary"><div><strong>{users.length}</strong><span>cuentas registradas</span></div><div><strong>{users.filter((item) => item.webAccess === 1).length}</strong><span>con acceso activo</span></div><div><strong>{users.filter((item) => item.role === "admin").length}</strong><span>administradores</span></div></div>
    {query.isLoading ? <div className="empty-row">Cargando usuarios...</div> : query.isError ? <div className="empty-row">No se pudieron cargar los usuarios.</div> : users.length === 0 ? <div className="empty-row">Todavía no hay usuarios Discord registrados.</div> : <div className="user-admin-list">{users.map((managed) => {
      const isOwner = managed.id === user?.id;
      return <article className={`user-admin-row ${managed.webAccess === 0 ? "blocked" : ""}`} key={managed.id}>
        <div className="user-admin-identity">{managed.discordAvatarUrl ? <img src={managed.discordAvatarUrl} alt="" /> : <span>{(managed.discordUsername || managed.name || "U").slice(0, 1).toUpperCase()}</span>}<div><strong>{managed.discordUsername || managed.name || "Usuario Discord"}</strong><small>{managed.discordNickname ? `@${managed.discordNickname}` : managed.discordUserId || managed.email || "Sin identificador Discord"}</small><small>Último acceso: {formatDate(managed.lastSignedIn)}</small></div></div>
        <div className="user-admin-meta"><Badge variant={managed.webAccess === 1 ? "default" : "secondary"}>{managed.webAccess === 1 ? "ACTIVO" : "BLOQUEADO"}</Badge>{isOwner && <Badge variant="outline">OWNER</Badge>}<small>Registrado: {formatDate(managed.createdAt)}</small></div>
        <label>Rol<select disabled={isOwner || update.isPending} value={managed.role} onChange={(event) => update.mutate({ id: managed.id, role: event.target.value as "user" | "admin" })}><option value="user">User</option><option value="admin">Administrador</option></select></label>
        <label>Plan<select disabled={isOwner || update.isPending} value={managed.plan} onChange={(event) => update.mutate({ id: managed.id, plan: event.target.value as "free" | "pro" | "premium" })}><option value="free">Free</option><option value="pro">Pro</option><option value="premium">Premium</option></select></label>
        <button className={`user-access-button ${managed.webAccess === 1 ? "danger" : "success"}`} disabled={isOwner || update.isPending} onClick={() => update.mutate({ id: managed.id, webAccess: managed.webAccess !== 1 })}>{managed.webAccess === 1 ? <><UserRoundX size={14} /> Bloquear web</> : <><UserRoundCheck size={14} /> Permitir web</>}</button>
      </article>;
    })}</div>}
    <div className="owner-users-note"><ShieldCheck size={15} /> Bloquear una cuenta revoca su acceso al dashboard en la siguiente solicitud; no elimina sus scripts, keys ni historial.</div>
  </section>;
}
