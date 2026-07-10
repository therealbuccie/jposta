"use client";

import * as React from "react";
import { Copy, Globe2, RefreshCw, ShieldCheck } from "lucide-react";

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
  { label: "Team Mailboxes", iconKey: "mailboxes" },
  { label: "Domains", iconKey: "globe", active: true },
  { label: "Billing", iconKey: "billing" },
  { label: "Workspace Settings", iconKey: "settings" },
];

const actions: QuickAction[] = [
  { label: "Add domain", iconKey: "globe" },
  { label: "Create mailbox", iconKey: "mailboxes" },
];

type Session = { token: string; user: { email: string; name: string } };
type Organization = { id: string; name: string; slug: string };
type Domain = { id: string; name: string; status: string; verificationError?: string | null };
type DnsRecord = { name: string; priority?: number; type: string; value: string };
type VerifyResult = {
  checks: Record<string, { actual: string[]; expected: string; passed: boolean }>;
  verified: boolean;
};

export default function DomainsPage() {
  const [session, setSession] = React.useState<Session | null>(null);
  const [organization, setOrganization] = React.useState<Organization | null>(null);
  const [domains, setDomains] = React.useState<Domain[]>([]);
  const [selectedDomain, setSelectedDomain] = React.useState<Domain | null>(null);
  const [dnsRecords, setDnsRecords] = React.useState<DnsRecord[]>([]);
  const [verifyResult, setVerifyResult] = React.useState<VerifyResult | null>(null);
  const [status, setStatus] = React.useState("Connect an account to start domain onboarding.");

  React.useEffect(() => {
    const savedSession = localStorage.getItem("jposta.session");
    const savedOrganization = localStorage.getItem("jposta.organization");
    if (savedSession) setSession(JSON.parse(savedSession) as Session);
    if (savedOrganization) setOrganization(JSON.parse(savedOrganization) as Organization);
  }, []);

  React.useEffect(() => {
    if (!session) return;
    void loadDomains(session.token);
  }, [session]);

  async function loadDomains(token = session?.token) {
    if (!token) return;
    const nextDomains = await apiRequest<Domain[]>("/domains", undefined, token);
    setDomains(nextDomains);
    setSelectedDomain((current) => current ?? nextDomains[0] ?? null);
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

  async function handleOrganization(formData: FormData) {
    if (!session) return;
    const nextOrganization = await apiRequest<Organization>(
      "/organizations",
      {
        name: formData.get("name"),
        slug: formData.get("slug"),
      },
      session.token,
    );
    localStorage.setItem("jposta.organization", JSON.stringify(nextOrganization));
    setOrganization(nextOrganization);
    setStatus(`Using organization ${nextOrganization.name}.`);
  }

  async function handleDomain(formData: FormData) {
    if (!session || !organization) return;
    const domain = await apiRequest<Domain>(
      "/domains",
      {
        name: formData.get("name"),
        organizationId: organization.id,
      },
      session.token,
    );
    setSelectedDomain(domain);
    setStatus(`Added ${domain.name}. Publish the DNS records, then verify.`);
    await loadDomains();
  }

  async function openDomain(domain: Domain) {
    if (!session) return;
    setSelectedDomain(domain);
    setVerifyResult(null);
    const response = await apiRequest<{ records: DnsRecord[] }>(
      `/domains/${domain.id}/dns-records`,
      undefined,
      session.token,
    );
    setDnsRecords(response.records);
  }

  async function verifyDomain() {
    if (!session || !selectedDomain) return;
    const result = await apiRequest<VerifyResult>(
      `/domains/${selectedDomain.id}/verify`,
      {},
      session.token,
    );
    setVerifyResult(result);
    setStatus(result.verified ? "Domain verified." : "DNS records are not fully verified yet.");
    await loadDomains();
  }

  return (
    <AppShell
      currentSection="Domains"
      navigation={navigation}
      quickActions={actions}
      searchPlaceholder="Search domains..."
      shellDescription="Business Workspace"
      shellTitle={organization?.name ?? "JPosta"}
      userEmail={session?.user.email ?? "owner@company.com"}
      userName={session?.user.name ?? "Workspace Admin"}
      workspace={organization?.name ?? "Business Workspace"}
      workspaceLabel="Domains"
    >
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-4">
          <GlassCard className="p-4 sm:p-5" intensity="soft">
            <Globe2 className="mb-3 h-5 w-5 text-sky-600" aria-hidden="true" />
            <h1 className="text-2xl font-semibold text-foreground">Domain onboarding</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{status}</p>
          </GlassCard>
          <SetupForms
            hasOrganization={Boolean(organization)}
            hasSession={Boolean(session)}
            onDomain={handleDomain}
            onLogin={handleLogin}
            onOrganization={handleOrganization}
          />
          <GlassCard className="p-4 sm:p-5" intensity="default">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Domains</h2>
              <GlassButton size="sm" onClick={() => loadDomains()}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Refresh
              </GlassButton>
            </div>
            <div className="grid gap-2">
              {domains.map((domain) => (
                <button
                  className="rounded-2xl border border-glass-edge/24 bg-white/60 p-3 text-left shadow-inner-glass transition hover:bg-white"
                  key={domain.id}
                  type="button"
                  onClick={() => openDomain(domain)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-foreground">{domain.name}</span>
                    <GlassBadge
                      tone={
                        domain.status === "VERIFIED" || domain.status === "ACTIVE"
                          ? "success"
                          : "neutral"
                      }
                    >
                      {domain.status}
                    </GlassBadge>
                  </div>
                  {domain.verificationError ? (
                    <p className="mt-1 text-xs text-rose-500">{domain.verificationError}</p>
                  ) : null}
                </button>
              ))}
            </div>
          </GlassCard>
        </div>

        <GlassCard className="p-4 sm:p-5" intensity="default">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">DNS records</p>
              <h2 className="text-xl font-semibold text-foreground">
                {selectedDomain?.name ?? "Select a domain"}
              </h2>
            </div>
            <GlassButton disabled={!selectedDomain} onClick={verifyDomain}>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Verify Domain
            </GlassButton>
          </div>
          <GlassDivider className="my-4" />
          <div className="grid gap-3">
            {dnsRecords.map((record) => (
              <div
                className="rounded-2xl border border-glass-edge/24 bg-white/64 p-3 shadow-inner-glass"
                key={`${record.type}-${record.name}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <GlassBadge>{record.type}</GlassBadge>
                  <GlassButton
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(record.value)}
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Copy
                  </GlassButton>
                </div>
                <p className="text-sm font-semibold text-foreground">{record.name}</p>
                <p className="mt-1 break-all text-xs leading-5 text-muted-foreground">
                  {record.value}
                </p>
                {record.priority ? (
                  <p className="mt-1 text-xs text-muted-foreground">Priority {record.priority}</p>
                ) : null}
              </div>
            ))}
          </div>
          {verifyResult ? (
            <div className="mt-5 grid gap-2">
              {Object.entries(verifyResult.checks).map(([name, check]) => (
                <div
                  className="rounded-2xl border border-glass-edge/24 bg-white/64 p-3 text-sm shadow-inner-glass"
                  key={name}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium capitalize text-foreground">{name}</span>
                    <GlassBadge tone={check.passed ? "success" : "warning"}>
                      {check.passed ? "Passed" : "Missing"}
                    </GlassBadge>
                  </div>
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    Expected: {check.expected}
                  </p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    Actual: {check.actual.join(", ") || "None"}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </GlassCard>
      </div>
    </AppShell>
  );
}

function SetupForms({
  hasOrganization,
  hasSession,
  onDomain,
  onLogin,
  onOrganization,
}: {
  hasOrganization: boolean;
  hasSession: boolean;
  onDomain: (formData: FormData) => void;
  onLogin: (formData: FormData) => void;
  onOrganization: (formData: FormData) => void;
}) {
  return (
    <GlassCard className="grid gap-3 p-4 sm:p-5" intensity="soft">
      <InlineForm
        button="Login"
        fields={[
          ["email", "Email"],
          ["password", "Password"],
        ]}
        onSubmit={onLogin}
      />
      <InlineForm
        button="Create organization"
        disabled={!hasSession}
        fields={[
          ["name", "Organization"],
          ["slug", "Slug"],
        ]}
        onSubmit={onOrganization}
      />
      <InlineForm
        button="Add domain"
        disabled={!hasSession || !hasOrganization}
        fields={[["name", "Domain"]]}
        onSubmit={onDomain}
      />
    </GlassCard>
  );
}

function InlineForm({
  button,
  disabled,
  fields,
  onSubmit,
}: {
  button: string;
  disabled?: boolean;
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
      <GlassButton disabled={disabled} type="submit">
        {button}
      </GlassButton>
    </form>
  );
}

async function apiRequest<T>(path: string, body?: Record<string, unknown>, token?: string) {
  const requestInit: RequestInit = {
    method: body ? "POST" : "GET",
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
