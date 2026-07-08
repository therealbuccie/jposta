import { Inbox, Mailbox, ShieldCheck, Sparkles } from "lucide-react";

import {
  AppShell,
  GlassBadge,
  GlassCard,
  GlassDivider,
  StatusIndicator,
  type QuickAction,
  type ShellNavItem,
} from "@jposta/ui";

const businessNavigation: ShellNavItem[] = [
  { label: "Inbox", iconKey: "inbox", active: true, badge: "18" },
  { label: "Compose", iconKey: "compose" },
  { label: "Team Mailboxes", iconKey: "mailboxes" },
  { label: "Domains", iconKey: "globe" },
  { label: "Aliases", iconKey: "sent" },
  { label: "Distribution Lists", iconKey: "customers" },
  { label: "Contacts", iconKey: "contacts" },
  { label: "Calendar", iconKey: "calendar" },
  { label: "Files", iconKey: "files" },
  { label: "Billing", iconKey: "billing" },
  { label: "Workspace Settings", iconKey: "settings" },
];

const businessActions: QuickAction[] = [
  { label: "Compose mail", iconKey: "compose" },
  { label: "Create mailbox", iconKey: "mailboxes" },
  { label: "Add domain", iconKey: "globe" },
];

export default function HomePage() {
  return (
    <AppShell
      currentSection="Inbox"
      navigation={businessNavigation}
      quickActions={businessActions}
      searchPlaceholder="Search company mail, domains, contacts..."
      shellDescription="Business Workspace"
      shellTitle="36T Studios"
      userEmail="owner@36t.studio"
      userName="Workspace Admin"
      workspace="36T Studios"
      workspaceLabel="Business Workspace"
    >
      <div className="grid gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <GlassBadge tone="premium">Business Workspace</GlassBadge>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal text-foreground md:text-4xl">
              Company email operations for 36T Studios.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Manage the company inbox, team mailboxes, domains, aliases, distribution lists,
              contacts, files, billing, and workspace settings from one crystal-clear command
              center.
            </p>
          </div>
          <StatusIndicator label="Company mail healthy" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <GlassCard className="min-h-[24rem] p-6" intensity="default">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Business canvas</p>
                <h2 className="mt-2 text-2xl font-semibold text-foreground">
                  Company mailbox overview
                </h2>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-200/65 bg-sky-50/72 shadow-inner-glass">
                <Mailbox className="h-5 w-5 text-sky-600" aria-hidden="true" />
              </div>
            </div>
            <GlassDivider className="my-6" />
            <div className="grid gap-3">
              {[
                ["support@36t.studio", "Shared customer mailbox"],
                ["billing@36t.studio", "Invoice and subscription notices"],
                ["hello@36t.studio", "Public company address"],
              ].map(([title, description]) => (
                <div
                  className="flex items-center justify-between rounded-2xl border border-glass-edge/24 bg-white/56 p-4 shadow-inner-glass"
                  key={title}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                  </div>
                  <Inbox className="h-4 w-4 text-sky-600/75" aria-hidden="true" />
                </div>
              ))}
            </div>
          </GlassCard>

          <div className="grid gap-4">
            <GlassCard className="p-5" intensity="soft">
              <Sparkles className="mb-4 h-5 w-5 text-sky-600" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-foreground">Company management</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This workspace represents the company and its IT owner, not an individual employee.
              </p>
            </GlassCard>
            <GlassCard className="p-5" intensity="soft">
              <ShieldCheck className="mb-4 h-5 w-5 text-emerald-600" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-foreground">Admin responsibilities</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Domains, aliases, distribution lists, billing, and workspace settings stay available
                here, while daily employee mail has a separate focused experience.
              </p>
            </GlassCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
