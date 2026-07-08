import { Activity, Gauge, LifeBuoy, ShieldCheck } from "lucide-react";

import {
  AppShell,
  GlassBadge,
  GlassCard,
  GlassDivider,
  StatusIndicator,
  type QuickAction,
  type ShellNavItem,
} from "@jposta/ui";

const platformNavigation: ShellNavItem[] = [
  { label: "Customers", iconKey: "customers", active: true },
  { label: "Workspaces", iconKey: "workspaces" },
  { label: "Domains", iconKey: "globe" },
  { label: "Mail Servers", iconKey: "server" },
  { label: "Billing", iconKey: "billing" },
  { label: "Platform Analytics", iconKey: "analytics" },
  { label: "Server Health", iconKey: "health", badge: "99" },
  { label: "Logs", iconKey: "logs" },
  { label: "Support Tickets", iconKey: "tickets", badge: "7" },
];

const platformActions: QuickAction[] = [
  { label: "Review tickets", iconKey: "support" },
  { label: "Check servers", iconKey: "server" },
  { label: "Open logs", iconKey: "logs" },
];

export default function AdminPage() {
  return (
    <AppShell
      currentSection="Customers"
      navigation={platformNavigation}
      quickActions={platformActions}
      searchPlaceholder="Search customers, workspaces, servers, tickets..."
      shellDescription="Platform Admin"
      shellTitle="JPosta Ops"
      userEmail="ops@jposta.com"
      userName="Platform Admin"
      workspace="JPosta Platform"
      workspaceLabel="Internal Workspace"
    >
      <div className="grid gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <GlassBadge>Platform Admin</GlassBadge>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal text-foreground md:text-4xl">
              Internal operations control for JPosta.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Super admins, technical teams, billing, and support use this workspace to operate the
              platform, customers, servers, billing, logs, and support queue.
            </p>
          </div>
          <StatusIndicator label="Platform systems ready" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { label: "Customer health", value: "Stable", icon: Gauge },
            { label: "Server posture", value: "Nominal", icon: ShieldCheck },
            { label: "Support load", value: "7 open", icon: LifeBuoy },
          ].map((metric) => (
            <GlassCard className="p-5" intensity="soft" key={metric.label}>
              <metric.icon className="mb-5 h-5 w-5 text-sky-600" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{metric.value}</p>
            </GlassCard>
          ))}
        </div>

        <GlassCard className="min-h-[22rem] p-6" intensity="default">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Operations canvas</p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                Platform operation modules
              </h2>
            </div>
            <GlassBadge tone="premium">Internal only</GlassBadge>
          </div>
          <GlassDivider className="my-6" />
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["Customer accounts", "Tenant ownership, plan, and support status."],
              ["Mail server fleet", "Provisioning state, health, and capacity."],
              ["Billing operations", "Invoices, failed payments, and plan overrides."],
              ["Support tickets", "Escalations and customer operations queue."],
            ].map(([title, description]) => (
              <div
                className="rounded-2xl border border-glass-edge/24 bg-white/56 p-4 shadow-inner-glass"
                key={title}
              >
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
            Port 3001 remains reserved for internal JPosta operations.
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
