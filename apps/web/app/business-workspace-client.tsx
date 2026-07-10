"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Globe2, Inbox, LogOut, Mailbox, ShieldCheck, Sparkles } from "lucide-react";

import {
  AppShell,
  GlassBadge,
  GlassButton,
  GlassCard,
  GlassDivider,
  GlassInput,
  StatusIndicator,
  type QuickAction,
  type ShellNavItem,
} from "@jposta/ui";

import {
  type AuthSession,
  type Domain,
  jpostaApi,
  type MailboxRecord,
  type Organization,
} from "@/lib/api-client";
import { formString } from "@/lib/form";
import {
  clearSession,
  getStoredOrganization,
  getStoredSession,
  saveOrganization,
} from "@/lib/session";

function customerNavigation(router: ReturnType<typeof useRouter>): ShellNavItem[] {
  return [
    { label: "Overview", iconKey: "inbox", active: true, onClick: () => router.push("/") },
    { label: "Domains", iconKey: "globe", onClick: () => router.push("/domains") },
    { label: "Mailboxes", iconKey: "mailboxes", onClick: () => router.push("/mailboxes") },
    { label: "Settings", iconKey: "settings" },
  ];
}

function customerActions(router: ReturnType<typeof useRouter>): QuickAction[] {
  return [
    { label: "Add domain", iconKey: "globe", onClick: () => router.push("/domains") },
    { label: "Create mailbox", iconKey: "mailboxes", onClick: () => router.push("/mailboxes") },
  ];
}

export function BusinessWorkspaceClient() {
  const router = useRouter();
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [organization, setOrganization] = React.useState<Organization | null>(null);
  const [domains, setDomains] = React.useState<Domain[]>([]);
  const [mailboxes, setMailboxes] = React.useState<MailboxRecord[]>([]);
  const [status, setStatus] = React.useState("Loading workspace...");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const storedSession = getStoredSession();
    if (!storedSession) {
      router.replace("/login");
      return;
    }

    setSession(storedSession);
    setOrganization(getStoredOrganization());
    void refreshWorkspace(storedSession);
  }, [router]);

  async function refreshWorkspace(activeSession = session) {
    if (!activeSession) return;
    setLoading(true);
    try {
      const organizations = await jpostaApi.listOrganizations(activeSession.token);
      const nextOrganization = organizations[0] ?? null;
      setOrganization(nextOrganization);
      if (nextOrganization) saveOrganization(nextOrganization);

      const [nextDomains, nextMailboxes] = await Promise.all([
        jpostaApi.listDomains(activeSession.token),
        jpostaApi.listMailboxes(activeSession.token),
      ]);
      setDomains(nextDomains);
      setMailboxes(nextMailboxes);
      setStatus(
        nextOrganization
          ? "Workspace connected to JPosta API."
          : "Create your workspace to continue.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load workspace.");
    } finally {
      setLoading(false);
    }
  }

  async function createWorkspace(formData: FormData) {
    if (!session) return;
    const name = formString(formData, "name").trim();
    setLoading(true);
    try {
      const nextOrganization = await jpostaApi.createOrganization(session.token, { name });
      saveOrganization(nextOrganization);
      setOrganization(nextOrganization);
      setStatus(`Created workspace ${nextOrganization.name}. Domain onboarding is ready.`);
      await refreshWorkspace(session);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create workspace.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearSession();
    router.replace("/login");
  }

  const verifiedDomains = domains.filter(
    (domain) => domain.status === "VERIFIED" || domain.status === "ACTIVE",
  );
  const mailboxRows = [
    [
      mailboxes[0]?.address ?? "admin@golyvin.com",
      mailboxes[0]
        ? `Status: ${mailboxes[0].status}`
        : "Create your first mailbox after DNS verification",
    ],
    [
      domains[0]?.name ?? "golyvin.com",
      domains[0]
        ? `Domain status: ${domains[0].status}`
        : "Add a custom domain from the Domains page",
    ],
    [
      organization?.name ?? "Business Workspace",
      organization ? "Customer workspace active" : "Workspace setup required",
    ],
  ] as const;

  return (
    <AppShell
      currentSection="Overview"
      navigation={customerNavigation(router)}
      quickActions={customerActions(router)}
      searchPlaceholder="Search company mail, domains, contacts..."
      shellDescription="Business Workspace"
      shellTitle={organization?.name ?? "JPosta"}
      userEmail={session?.user.email ?? "owner@company.com"}
      userName={session?.user.name ?? "Workspace Admin"}
      workspace={organization?.name ?? "Business Workspace"}
      workspaceLabel="Business Workspace"
    >
      <div className="grid gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <GlassBadge tone="premium">Business Workspace</GlassBadge>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal text-foreground md:text-4xl">
              {organization
                ? `Company email operations for ${organization.name}.`
                : "Create your workspace."}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Manage custom domains, DNS verification, and team mailboxes from the customer-facing
              JPosta workspace served at jposta.com.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusIndicator label={organization ? "Workspace active" : "Setup required"} />
            <GlassButton variant="ghost" onClick={logout}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Logout
            </GlassButton>
          </div>
        </div>

        {!organization ? (
          <GlassCard className="p-5 sm:p-6" intensity="default">
            <Sparkles className="mb-4 h-5 w-5 text-sky-600" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-foreground">Create your workspace</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Add your organization name to unlock domain onboarding and mailbox provisioning.
            </p>
            <form
              className="mt-5 grid gap-3 sm:max-w-md"
              onSubmit={(event) => {
                event.preventDefault();
                void createWorkspace(new FormData(event.currentTarget));
              }}
            >
              <GlassInput name="name" placeholder="Organization name" required />
              <GlassButton disabled={loading} type="submit" variant="primary">
                Create workspace
              </GlassButton>
            </form>
            <p className="mt-4 text-sm text-muted-foreground">{status}</p>
          </GlassCard>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <GlassCard className="min-h-[24rem] p-5 sm:p-6" intensity="default">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Business canvas</p>
                  <h2 className="mt-2 text-2xl font-semibold text-foreground">
                    Custom-domain mailbox overview
                  </h2>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-200/65 bg-sky-50/72 shadow-inner-glass">
                  <Mailbox className="h-5 w-5 text-sky-600" aria-hidden="true" />
                </div>
              </div>
              <GlassDivider className="my-6" />
              <div className="grid gap-3">
                {mailboxRows.map(([title, description]) => (
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
                <Globe2 className="mb-4 h-5 w-5 text-sky-600" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-foreground">Domains</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {domains.length
                    ? `${domains.length} domain${domains.length === 1 ? "" : "s"} connected.`
                    : "Add golyvin.com from the Domains page."}
                </p>
                <GlassButton className="mt-4" onClick={() => router.push("/domains")}>
                  Open Domains
                </GlassButton>
              </GlassCard>
              <GlassCard className="p-5" intensity="soft">
                <ShieldCheck className="mb-4 h-5 w-5 text-emerald-600" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-foreground">Mailboxes</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {verifiedDomains.length
                    ? "Verified domains are ready for mailbox creation."
                    : "Verify a domain before creating mailboxes."}
                </p>
                <GlassButton className="mt-4" onClick={() => router.push("/mailboxes")}>
                  Open Mailboxes
                </GlassButton>
              </GlassCard>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
