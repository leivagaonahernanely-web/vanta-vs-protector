export type DashboardNavItem = {
  group: "Workspace" | "Protection" | "Panels";
  label: "Overview" | "Scripts" | "Obfuscator" | "Block Builder" | "License keys" | "Plan keys" | "HWID bans" | "Logs" | "Plans" | "Create New Panel" | "Manage Panels" | "Prices" | "Updates";
  icon: "overview" | "scripts" | "obfuscator" | "builder" | "keys" | "hwid" | "logs" | "plans" | "panel" | "prices" | "updates" | "settings";
  badge?: "scripts";
};

export const dashboardNavItems: DashboardNavItem[] = [
  { group: "Workspace", label: "Overview", icon: "overview" },
  { group: "Workspace", label: "Scripts", icon: "scripts", badge: "scripts" },
  { group: "Workspace", label: "Obfuscator", icon: "obfuscator" },
  { group: "Workspace", label: "Block Builder", icon: "builder" },
  { group: "Protection", label: "License keys", icon: "keys" },
  { group: "Protection", label: "Plan keys", icon: "keys" },
  { group: "Protection", label: "HWID bans", icon: "hwid" },
  { group: "Protection", label: "Logs", icon: "logs" },
  { group: "Protection", label: "Plans", icon: "plans" },
  { group: "Panels", label: "Create New Panel", icon: "panel" },
  { group: "Panels", label: "Manage Panels", icon: "panel" },
  { group: "Panels", label: "Prices", icon: "prices" },
  { group: "Panels", label: "Updates", icon: "updates" },
];

export function getDashboardNavLabels() {
  return dashboardNavItems.map((item) => item.label);
}

export function getOverviewCopy() {
  return {
    title: "Vanta.vs Protector",
    description: "Protección y entrega controlada de scripts Lua.",
    purpose: "Protección, alojamiento y control de acceso para scripts Lua.",
  };
}
