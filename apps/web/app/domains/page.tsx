"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Globe2, Plus, RefreshCw, ShieldCheck, X } from "lucide-react";

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
      await loadDomains(activeSession, undefined, nextOrganization);
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
    const [detail, dns] = await Promise.all([
      jpostaApi.getDomain(activeSession.token, domain.id),
      jpostaApi.getDomainDnsRecords(activeSession.token, domain.id),
    ]);
    setSelectedDomain(detail);
    setDnsRecords(dns.records);
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
