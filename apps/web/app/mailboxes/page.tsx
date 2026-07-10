"use client";

import * as React from "react";
import { Mailbox, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";

import {
  AppShell,
  GlassBadge,
  GlassButton,
  GlassCard,
  GlassDivider,
  GlassInput,
  type QuickAction,
  type ShellNavItem,
} from "@jposta/ui";

import { env } from "@/lib/env";

const navigation: ShellNavItem[] = [
  { label: "Inbox", iconKey: "inbox" },
  { label: "Team Mailboxes", iconKey: "mailboxes", active: true },
  { label: "Domains", iconKey: "globe" },
  { label: "Billing", iconKey: "billing" },
  { label: "Workspace Settings", iconKey: "settings" },
];

const actions: QuickAction[] = [
  { label: "Create mailbox", iconKey: "mailboxes" },
  { label: "Add domain", iconKey: "globe" },
];

type Session = { token: string; user: { email: string; name: string } };
type Organization = { id: string; name: string; slug: string };
type Domain = { id: string; name: string; status: string };
type MailboxRecord = {
  address: string;
  displayName: string;
  id: string;
  provisioningError?: string | null;
  quotaMb: number;
  status: string;
};

export default function MailboxesPage() {
  const [session, setSession] = React.useState<Session | null>(null);
  const [organization, setOrganization] = React.useState<Organization | null>(null);
  const [domains, setDomains] = React.useState<Domain[]>([]);
  const [mailboxes, setMailboxes] = React.useState<MailboxRecord[]>([]);
  const [status, setStatus] = React.useState(
    "Login and select a verified domain to provision mailboxes.",
  );

  React.useEffect(() => {
    const savedSession = localStorage.getItem("jposta.session");
    const savedOrganization = localStorage.getItem("jposta.organization");
    if (savedSession) setSession(JSON.parse(savedSession) as Session);
    if (savedOrganization) setOrganization(JSON.parse(savedOrganization) as Organization);
  }, []);

  React.useEffect(() => {
    if (!session) return;
    void refresh(session.token);
  }, [session]);

  async function refresh(token = session?.token) {
    if (!token) return;
    const [nextDomains, nextMailboxes] = await Promise.all([
      apiRequest<Domain[]>("/domains", undefined, token),
      apiRequest<MailboxRecord[]>("/mailboxes", undefined, token),
    ]);
    setDomains(
      nextDomains.filter((domain) => domain.status === "VERIFIED" || domain.status === "ACTIVE"),
    );
    setMailboxes(nextMailboxes);
  }

  async function handleLogin(formData: FormData) {
    const nextSession = await apiRequest<Session>("/auth/login", {
      email: formData.get("email"),
      password: formData.get("password"),
    });
    localStorage.setItem("jposta.session", JSON.stringify(nextSession));
    setSession(nextSession);
    setStatus(`Logged in as ${nextSession.user.email}.`);
  }

  async function handleCreate(formData: FormData) {
    if (!session || !organization) return;
    await apiRequest<MailboxRecord>(
      "/mailboxes",
      {
        organizationId: organization.id,
        domainId: formData.get("domainId"),
        localPart: formData.get("localPart"),
        displayName: formData.get("displayName"),
        password: formData.get("password"),
        quotaMb: Number(formData.get("quotaMb") || 5120),
      },
      session.token,
    );
    setStatus("Mailbox provisioning requested.");
    await refresh();
  }

  async function resetPassword(mailbox: MailboxRecord) {
    const password = window.prompt(`New password for ${mailbox.address}`);
    if (!password || !session) return;
    await apiRequest(`/mailboxes/${mailbox.id}/password`, { password }, session.token, "PATCH");
    setStatus(`Password reset for ${mailbox.address}.`);
  }

  async function suspendMailbox(mailbox: MailboxRecord) {
    if (!session) return;
    await apiRequest(`/mailboxes/${mailbox.id}/suspend`, {}, session.token, "PATCH");
    setStatus(`Suspended ${mailbox.address}.`);
    await refresh();
  }

  async function deleteMailbox(mailbox: MailboxRecord) {
    if (!session || !window.confirm(`Delete ${mailbox.address}?`)) return;
    await apiRequest(`/mailboxes/${mailbox.id}`, undefined, session.token, "DELETE");
    setStatus(`Deleted ${mailbox.address}.`);
    await refresh();
  }

  return (
    <AppShell
      currentSection="Team Mailboxes"
      navigation={navigation}
      quickActions={actions}
      searchPlaceholder="Search mailboxes..."
      shellDescription="Business Workspace"
      shellTitle={organization?.name ?? "JPosta"}
      userEmail={session?.user.email ?? "owner@company.com"}
      userName={session?.user.name ?? "Workspace Admin"}
      workspace={organization?.name ?? "Business Workspace"}
      workspaceLabel="Mailboxes"
    >
      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="grid gap-4">
          <GlassCard className="p-4 sm:p-5" intensity="soft">
            <Mailbox className="mb-3 h-5 w-5 text-sky-600" aria-hidden="true" />
            <h1 className="text-2xl font-semibold text-foreground">Mailbox provisioning</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{status}</p>
          </GlassCard>
          <GlassCard className="grid gap-3 p-4 sm:p-5" intensity="soft">
            <InlineForm
              button="Login"
              fields={[
                ["email", "Email"],
                ["password", "Password"],
              ]}
              onSubmit={handleLogin}
            />
            <form
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreate(new FormData(event.currentTarget));
              }}
            >
              <select
                className="h-11 rounded-control border border-input bg-white/70 px-3 text-sm text-foreground"
                name="domainId"
                required
              >
                <option value="">Verified domain</option>
                {domains.map((domain) => (
                  <option key={domain.id} value={domain.id}>
                    {domain.name}
                  </option>
                ))}
              </select>
              <GlassInput name="localPart" placeholder="support" />
              <GlassInput name="displayName" placeholder="Support Team" />
              <GlassInput name="password" placeholder="Mailbox password" type="password" />
              <GlassInput name="quotaMb" placeholder="5120" type="number" />
              <GlassButton
                disabled={!session || !organization || domains.length === 0}
                type="submit"
              >
                Create mailbox
              </GlassButton>
            </form>
          </GlassCard>
        </div>

        <GlassCard className="p-4 sm:p-5" intensity="default">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Provisioned accounts</p>
              <h2 className="text-xl font-semibold text-foreground">Mailboxes</h2>
            </div>
            <GlassButton size="sm" onClick={() => refresh()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </GlassButton>
          </div>
          <GlassDivider className="my-4" />
          <div className="grid gap-3">
            {mailboxes.map((mailbox) => (
              <div
                className="rounded-2xl border border-glass-edge/24 bg-white/64 p-4 shadow-inner-glass"
                key={mailbox.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-all text-sm font-semibold text-foreground">
                      {mailbox.address}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {mailbox.displayName} / {mailbox.quotaMb} MB
                    </p>
                    {mailbox.provisioningError ? (
                      <p className="mt-1 text-xs text-rose-500">{mailbox.provisioningError}</p>
                    ) : null}
                  </div>
                  <GlassBadge
                    tone={
                      mailbox.status === "ACTIVE"
                        ? "success"
                        : mailbox.status === "FAILED"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {mailbox.status}
                  </GlassBadge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <GlassButton size="sm" onClick={() => resetPassword(mailbox)}>
                    Reset password
                  </GlassButton>
                  <GlassButton size="sm" onClick={() => suspendMailbox(mailbox)}>
                    <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                    Suspend
                  </GlassButton>
                  <GlassButton size="sm" variant="ghost" onClick={() => deleteMailbox(mailbox)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete
                  </GlassButton>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}

function InlineForm({
  button,
  fields,
  onSubmit,
}: {
  button: string;
  fields: string[][];
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
      }}
    >
      {fields.map(([name, placeholder]) => (
        <GlassInput
          key={name}
          name={name}
          placeholder={placeholder}
          type={name === "password" ? "password" : "text"}
        />
      ))}
      <GlassButton type="submit">{button}</GlassButton>
    </form>
  );
}

async function apiRequest<T>(
  path: string,
  body?: Record<string, unknown>,
  token?: string,
  method?: "DELETE" | "PATCH" | "POST",
) {
  const requestInit: RequestInit = {
    method: method ?? (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  if (body) {
    requestInit.body = JSON.stringify(body);
  }

  const response = await fetch(`${env.apiUrl}${path}`, requestInit);
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok)
    throw new Error((payload as { message?: string } | null)?.message || "Request failed.");
  return payload as T;
}
