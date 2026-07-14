"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Cloud, Copy, Globe2, KeyRound, Plus, RefreshCw, ShieldCheck, X } from "lucide-react";

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

import {
  type AuthSession,
  type DnsRecord,
  type DnsPlan,
  type DnsProviderConnection,
  type Domain,
  jpostaApi,
  type Organization,
  type VerifyResult,
} from "@/lib/api-client";
import { formString } from "@/lib/form";
import {
  clearSession,
  getStoredOrganization,
  getStoredSession,
  saveOrganization,
} from "@/lib/session";

function navigation(router: ReturnType<typeof useRouter>): ShellNavItem[] {
  return [
    { label: "Overview", iconKey: "inbox", onClick: () => router.push("/") },
    { label: "Domains", iconKey: "globe", active: true, onClick: () => router.push("/domains") },
    { label: "Mailboxes", iconKey: "mailboxes", onClick: () => router.push("/mailboxes") },
    { label: "Settings", iconKey: "settings" },
  ];
}

function actions(openAddDomain: () => void, router: ReturnType<typeof useRouter>): QuickAction[] {
  return [
    { label: "Add domain", iconKey: "globe", onClick: openAddDomain },
    { label: "Create mailbox", iconKey: "mailboxes", onClick: () => router.push("/mailboxes") },
  ];
}

export default function DomainsPage() {
  const router = useRouter();
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [organization, setOrganization] = React.useState<Organization | null>(null);
  const [domains, setDomains] = React.useState<Domain[]>([]);
  const [selectedDomain, setSelectedDomain] = React.useState<Domain | null>(null);
  const [dnsRecords, setDnsRecords] = React.useState<DnsRecord[]>([]);
  const [verifyResult, setVerifyResult] = React.useState<VerifyResult | null>(null);
  const [providerConnection, setProviderConnection] = React.useState<DnsProviderConnection | null>(
    null,
  );
  const [dnsPlan, setDnsPlan] = React.useState<DnsPlan | null>(null);
  const [applyingDns, setApplyingDns] = React.useState(false);
  const [status, setStatus] = React.useState("Loading domains...");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [addDomainOpen, setAddDomainOpen] = React.useState(false);

  React.useEffect(() => {
    const storedSession = getStoredSession();
    if (!storedSession) {
      router.replace("/login");
      return;
    }

    setSession(storedSession);
    setOrganization(getStoredOrganization());
    void bootstrap(storedSession);
  }, [router]);

  async function bootstrap(activeSession: AuthSession) {
    setLoading(true);
    try {
      const organizations = await jpostaApi.listOrganizations(activeSession.token);
      const nextOrganization = organizations[0] ?? null;
      setOrganization(nextOrganization);
      if (nextOrganization) saveOrganization(nextOrganization);
      const requestedDomain =
        new URLSearchParams(window.location.search).get("domainId") ?? undefined;
      const providerError = new URLSearchParams(window.location.search).get("providerError");
      if (providerError) setError(providerError);
      await loadDomains(activeSession, requestedDomain, nextOrganization);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load domains.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDomains(
    activeSession = session,
    selectedId?: string,
    activeOrganization = organization,
  ) {
    if (!activeSession) return;
    const nextDomains = await jpostaApi.listDomains(activeSession.token);
    setDomains(nextDomains);
    const nextSelected =
      nextDomains.find((domain) => domain.id === selectedId) ?? nextDomains[0] ?? null;
    if (nextSelected) {
      await openDomain(nextSelected, activeSession);
    } else {
      setSelectedDomain(null);
      setDnsRecords([]);
      setVerifyResult(null);
    }
    setStatus(activeOrganization ? "Domains loaded." : "Create a workspace before adding domains.");
  }

  async function openDomain(domain: Domain, activeSession = session) {
    if (!activeSession) return;
    setError(null);
    setVerifyResult(null);
    const [detail, dns, connection] = await Promise.all([
      jpostaApi.getDomain(activeSession.token, domain.id),
      jpostaApi.getDomainDnsRecords(activeSession.token, domain.id),
      jpostaApi.domainProviderStatus(activeSession.token, domain.id),
    ]);
    setSelectedDomain(detail);
    setDnsRecords(dns.records);
    setProviderConnection(connection);
    if (connection.connected) {
      try {
        setDnsPlan(await jpostaApi.previewDnsPlan(activeSession.token, domain.id));
      } catch (reason) {
        setDnsPlan(null);
        setError(reason instanceof Error ? reason.message : "Could not preview DNS changes.");
      }
    } else {
      setDnsPlan(null);
    }
  }

  async function addDomain(formData: FormData) {
    if (!session || !organization) return;
    setError(null);
    setLoading(true);
    try {
      const name = normalizeDomainInput(formString(formData, "name"));
      const domain = await jpostaApi.createDomain(session.token, {
        name,
        organizationId: organization.id,
      });
      setAddDomainOpen(false);
      setStatus(`Added ${domain.name}. Publish the DNS records, then verify.`);
      await loadDomains(session, domain.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add domain.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyDomain() {
    if (!session || !selectedDomain) return;
    setError(null);
    try {
      const result = await jpostaApi.verifyDomain(session.token, selectedDomain.id);
      setVerifyResult(result);
      setStatus(
        result.verified
          ? "Domain verified � ready to create mailboxes."
          : "DNS records are not fully verified yet.",
      );
      await loadDomains(session, selectedDomain.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not verify domain.");
    }
  }

  async function redetectProvider() {
    if (!session || !selectedDomain) return;
    setError(null);
    try {
      await jpostaApi.redetectDomainProvider(session.token, selectedDomain.id);
      await loadDomains(session, selectedDomain.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not detect the DNS provider.");
    }
  }

  async function connectCloudflare() {
    if (!session || !selectedDomain) return;
    setError(null);
    try {
      const result = await jpostaApi.authorizeCloudflare(session.token, selectedDomain.id);
      window.location.assign(result.authorizationUrl);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not start Cloudflare authorization.",
      );
    }
  }

  async function connectNamecheap(formData: FormData) {
    if (!session || !selectedDomain) return;
    setError(null);
    setLoading(true);
    try {
      await jpostaApi.connectNamecheap(session.token, selectedDomain.id, {
        apiUser: formString(formData, "apiUser"),
        apiKey: formString(formData, "apiKey"),
      });
      await openDomain(selectedDomain, session);
      setStatus("Namecheap connected. Review the DNS changes before applying them.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not connect Namecheap.");
    } finally {
      setLoading(false);
    }
  }

  async function applyDnsPlan() {
    if (!session || !selectedDomain || !dnsPlan) return;
    setApplyingDns(true);
    setError(null);
    try {
      const result = await jpostaApi.applyDnsPlan(session.token, selectedDomain.id, {
        sourceFingerprint: dnsPlan.sourceFingerprint,
        confirmConflicts: true,
      });
      setVerifyResult(result.verification);
      if (result.verification.verified) {
        setStatus("Domain verified — provider access has been removed.");
      } else {
        setStatus("Records applied. Waiting for public DNS propagation...");
        for (let attempt = 0; attempt < 24; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 5000));
          const verification = await jpostaApi.verifyDomain(session.token, selectedDomain.id);
          setVerifyResult(verification);
          if (verification.verified) {
            setStatus("Domain verified — provider access has been removed.");
            break;
          }
        }
      }
      await loadDomains(session, selectedDomain.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not apply DNS changes.");
      try {
        setDnsPlan(await jpostaApi.previewDnsPlan(session.token, selectedDomain.id));
      } catch {
        // The provider error shown above is more useful than a secondary preview failure.
      }
    } finally {
      setApplyingDns(false);
    }
  }

  function logout() {
    clearSession();
    router.replace("/login");
  }

  return (
    <AppShell
      currentSection="Domains"
      navigation={navigation(router)}
      quickActions={actions(() => setAddDomainOpen(true), router)}
      searchPlaceholder="Search domains..."
      shellDescription="Business Workspace"
      shellTitle={organization?.name ?? "JPosta"}
      userEmail={session?.user.primaryEmail ?? session?.user.email ?? "owner@company.com"}
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
            {error ? <p className="mt-2 text-sm text-rose-500">{error}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <GlassButton
                disabled={!organization}
                onClick={() => setAddDomainOpen(true)}
                variant="primary"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Domain
              </GlassButton>
              <GlassButton onClick={() => loadDomains()}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Refresh
              </GlassButton>
              <GlassButton variant="ghost" onClick={logout}>
                Logout
              </GlassButton>
            </div>
          </GlassCard>

          <GlassCard className="p-4 sm:p-5" intensity="default">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Domains</h2>
            {loading ? <p className="text-sm text-muted-foreground">Loading domains...</p> : null}
            {!loading && domains.length === 0 ? (
              <div className="rounded-2xl border border-glass-edge/24 bg-white/60 p-4 text-sm text-muted-foreground shadow-inner-glass">
                No domains yet. Add golyvin.com to begin onboarding.
              </div>
            ) : null}
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
                    <StatusBadge status={domain.status} />
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
          {selectedDomain ? (
            <ProviderAutomation
              applying={applyingDns}
              connection={providerConnection}
              domain={selectedDomain}
              loading={loading}
              plan={dnsPlan}
              onApply={applyDnsPlan}
              onCloudflare={connectCloudflare}
              onNamecheap={connectNamecheap}
              onRedetect={redetectProvider}
            />
          ) : null}
          <GlassDivider className="my-4" />
          <div className="grid gap-3">
            {dnsRecords.map((record) => (
              <DnsRecordCard key={`${record.type}-${record.name}`} record={record} />
            ))}
          </div>
          {verifyResult ? <VerificationResult result={verifyResult} /> : null}
          {verifyResult?.verified ? (
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 text-sm font-medium text-emerald-700">
              Domain verified � ready to create mailboxes.
            </div>
          ) : null}
        </GlassCard>
      </div>

      {addDomainOpen ? (
        <Modal title="Add domain" onClose={() => setAddDomainOpen(false)}>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void addDomain(new FormData(event.currentTarget));
            }}
          >
            <GlassInput name="name" placeholder="golyvin.com" required />
            <GlassButton disabled={!organization || loading} type="submit" variant="primary">
              Add Domain
            </GlassButton>
          </form>
        </Modal>
      ) : null}
    </AppShell>
  );
}

function ProviderAutomation({
  applying,
  connection,
  domain,
  loading,
  plan,
  onApply,
  onCloudflare,
  onNamecheap,
  onRedetect,
}: {
  applying: boolean;
  connection: DnsProviderConnection | null;
  domain: Domain;
  loading: boolean;
  plan: DnsPlan | null;
  onApply: () => Promise<void>;
  onCloudflare: () => Promise<void>;
  onNamecheap: (formData: FormData) => Promise<void>;
  onRedetect: () => Promise<void>;
}) {
  const [confirmed, setConfirmed] = React.useState(false);

  React.useEffect(() => setConfirmed(false), [plan?.sourceFingerprint]);

  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 shadow-inner-glass">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-sky-700">DNS provider</p>
          <p className="mt-1 font-semibold text-foreground">{providerLabel(domain.dnsProvider)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {domain.detectedNameservers?.join(", ") || "No authoritative nameservers detected."}
          </p>
        </div>
        <GlassButton size="sm" onClick={() => void onRedetect()}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Detect again
        </GlassButton>
      </div>

      {!connection?.connected && domain.dnsProvider === "CLOUDFLARE" ? (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            Log in to Cloudflare and approve temporary Zone Read, DNS Read, and DNS Write access.
          </p>
          <GlassButton className="mt-3" variant="primary" onClick={() => void onCloudflare()}>
            <Cloud className="h-4 w-4" aria-hidden="true" />
            Connect Cloudflare
          </GlassButton>
        </div>
      ) : null}

      {!connection?.connected && domain.dnsProvider === "NAMECHEAP" ? (
        <div className="mt-4 grid gap-3">
          <p className="text-sm leading-6 text-muted-foreground">
            In Namecheap, enable API access and whitelist JPosta&apos;s IPv4 address
            {connection?.namecheap.clientIp ? ` (${connection.namecheap.clientIp})` : ""}. JPosta
            stores the key only until verification completes.
          </p>
          {!connection?.namecheap.configured ? (
            <p className="text-sm font-medium text-amber-700">
              Namecheap automation is unavailable until NAMECHEAP_CLIENT_IP is configured.
            </p>
          ) : null}
          <form
            className="grid gap-2 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void onNamecheap(new FormData(event.currentTarget));
            }}
          >
            <GlassInput name="apiUser" placeholder="Namecheap API username" required />
            <GlassInput name="apiKey" placeholder="Namecheap API key" required type="password" />
            <GlassButton
              className="sm:col-span-2"
              disabled={loading || !connection?.namecheap.configured}
              type="submit"
              variant="primary"
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Connect Namecheap
            </GlassButton>
          </form>
        </div>
      ) : null}

      {!connection?.connected && (!domain.dnsProvider || domain.dnsProvider === "UNKNOWN") ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Automatic setup is not available for this provider. Add the DNS records below manually,
          then select Verify Domain.
        </p>
      ) : null}

      {connection?.connected && plan ? (
        <div className="mt-4 grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">Review proposed changes</p>
            <GlassBadge tone={plan.hasConflicts ? "warning" : "success"}>
              {plan.hasConflicts ? "Mail routing changes" : "Ready"}
            </GlassBadge>
          </div>
          {plan.items.map((item) => (
            <div
              className="rounded-xl border border-white/80 bg-white/75 p-3 text-xs"
              key={item.key}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold uppercase text-foreground">{item.key}</span>
                <GlassBadge tone={item.action === "CONFLICT" ? "warning" : "neutral"}>
                  {item.action}
                </GlassBadge>
              </div>
              <p className="mt-1 text-muted-foreground">{item.message}</p>
              {item.desired ? (
                <p className="mt-1 break-all font-mono text-[11px] text-foreground">
                  {item.desired.type} {item.desired.name} → {item.desired.content}
                </p>
              ) : null}
            </div>
          ))}
          <label className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
            <input
              checked={confirmed}
              className="mt-0.5"
              type="checkbox"
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I approve these DNS changes and understand that replacing MX records changes mail
            delivery to JPosta.
          </label>
          <GlassButton
            disabled={!confirmed || applying}
            variant="primary"
            onClick={() => void onApply()}
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {applying ? "Applying and verifying..." : "Apply records automatically"}
          </GlassButton>
        </div>
      ) : null}
    </div>
  );
}

function providerLabel(provider: Domain["dnsProvider"]) {
  if (provider === "CLOUDFLARE") return "Cloudflare detected";
  if (provider === "NAMECHEAP") return "Namecheap detected";
  return "Provider not recognized";
}

function DnsRecordCard({ record }: { record: DnsRecord }) {
  return (
    <div className="rounded-2xl border border-glass-edge/24 bg-white/64 p-3 shadow-inner-glass">
      <div className="mb-2 flex items-center justify-between gap-2">
        <GlassBadge>{record.type}</GlassBadge>
        <GlassButton size="sm" onClick={() => navigator.clipboard.writeText(record.value)}>
          <Copy className="h-4 w-4" aria-hidden="true" />
          Copy
        </GlassButton>
      </div>
      <p className="text-sm font-semibold text-foreground">{record.name}</p>
      <p className="mt-1 break-all text-xs leading-5 text-muted-foreground">{record.value}</p>
      {record.priority ? (
        <p className="mt-1 text-xs text-muted-foreground">Priority {record.priority}</p>
      ) : null}
    </div>
  );
}

function VerificationResult({ result }: { result: VerifyResult }) {
  return (
    <div className="mt-5 grid gap-2">
      {Object.entries(result.checks).map(([name, check]) => (
        <div
          className="rounded-2xl border border-glass-edge/24 bg-white/64 p-3 text-sm shadow-inner-glass"
          key={name}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium capitalize text-foreground">{name}</span>
            <GlassBadge tone={check.passed ? "success" : "warning"}>
              {check.passed ? "Passed" : "Failed"}
            </GlassBadge>
          </div>
          <p className="mt-1 break-all text-xs text-muted-foreground">Expected: {check.expected}</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            Actual: {check.actual.join(", ") || "None"}
          </p>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: Domain["status"] }) {
  return (
    <GlassBadge
      tone={
        status === "VERIFIED" || status === "ACTIVE"
          ? "success"
          : status === "FAILED"
            ? "warning"
            : "neutral"
      }
    >
      {status}
    </GlassBadge>
  );
}

function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-white/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[1.5rem] border border-glass-edge/32 bg-white/95 p-5 shadow-glass">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <GlassButton size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </GlassButton>
        </div>
        {children}
      </div>
    </div>
  );
}

function normalizeDomainInput(value: string) {
  const domain = value.trim().toLowerCase();

  if (domain.includes("://") || domain.includes("/") || domain.includes("@")) {
    throw new Error("Enter only the domain name, for example golyvin.com.");
  }

  if (!/^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(domain)) {
    throw new Error("Enter a valid domain name.");
  }

  return domain;
}
