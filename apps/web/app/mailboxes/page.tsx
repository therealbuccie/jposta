"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mailbox, Plus, RefreshCw, ShieldAlert, Trash2, X } from "lucide-react";

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
    { label: "Overview", iconKey: "inbox", onClick: () => router.push("/") },
    { label: "Domains", iconKey: "globe", onClick: () => router.push("/domains") },
    {
      label: "Mailboxes",
      iconKey: "mailboxes",
      active: true,
      onClick: () => router.push("/mailboxes"),
    },
    { label: "Settings", iconKey: "settings" },
  ];
}

function customerActions(
  openCreateMailbox: () => void,
  router: ReturnType<typeof useRouter>,
): QuickAction[] {
  return [
    { label: "Create mailbox", iconKey: "mailboxes", onClick: openCreateMailbox },
    { label: "Add domain", iconKey: "globe", onClick: () => router.push("/domains") },
  ];
}

export default function MailboxesPage() {
  const router = useRouter();
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [organization, setOrganization] = React.useState<Organization | null>(null);
  const [domains, setDomains] = React.useState<Domain[]>([]);
  const [mailboxes, setMailboxes] = React.useState<MailboxRecord[]>([]);
  const [status, setStatus] = React.useState("Loading mailboxes...");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);

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
      await refresh(activeSession, nextOrganization);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load mailboxes.");
    } finally {
      setLoading(false);
    }
  }

  async function refresh(activeSession = session, activeOrganization = organization) {
    if (!activeSession) return;
    setError(null);
    const [nextDomains, nextMailboxes] = await Promise.all([
      jpostaApi.listDomains(activeSession.token),
      jpostaApi.listMailboxes(activeSession.token),
    ]);
    setDomains(nextDomains);
    setMailboxes(nextMailboxes);
    const verifiedCount = nextDomains.filter(isDomainReady).length;
    setStatus(
      activeOrganization
        ? `${verifiedCount} verified domain${verifiedCount === 1 ? "" : "s"} available for mailbox creation.`
        : "Create a workspace before provisioning mailboxes.",
    );
  }

  async function createMailbox(formData: FormData) {
    if (!session || !organization) return;
    setLoading(true);
    setError(null);
    try {
      const domainId = formString(formData, "domainId");
      const domain = domains.find((item) => item.id === domainId);
      const localPart = normalizeLocalPart(formString(formData, "localPart"));
      const password = formString(formData, "password");
      const confirmPassword = formString(formData, "confirmPassword");

      if (!domain || !isDomainReady(domain)) {
        throw new Error("Select a verified or active domain before creating a mailbox.");
      }

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      const mailbox = await jpostaApi.createMailbox(session.token, {
        organizationId: organization.id,
        domainId,
        localPart,
        displayName: formString(formData, "displayName").trim(),
        password,
        quotaMb: Number(formData.get("quotaMb") || 5120),
      });
      setStatus(`Created ${mailbox.address}. Provisioning status: ${mailbox.status}.`);
      setCreateOpen(false);
      await refresh(session, organization);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create mailbox.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(mailbox: MailboxRecord) {
    if (!session) return;
    const password = window.prompt(`New password for ${mailbox.address}`);
    if (!password) return;
    setError(null);
    try {
      await jpostaApi.resetMailboxPassword(session.token, mailbox.id, password);
      setStatus(`Password reset for ${mailbox.address}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not reset password.");
    }
  }

  async function suspendMailbox(mailbox: MailboxRecord) {
    if (!session || !window.confirm(`Suspend ${mailbox.address}?`)) return;
    setError(null);
    try {
      await jpostaApi.suspendMailbox(session.token, mailbox.id);
      setStatus(`Suspended ${mailbox.address}.`);
      await refresh(session, organization);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not suspend mailbox.");
    }
  }

  async function deleteMailbox(mailbox: MailboxRecord) {
    if (!session || !window.confirm(`Delete ${mailbox.address}? This cannot be undone.`)) return;
    setError(null);
    try {
      await jpostaApi.deleteMailbox(session.token, mailbox.id);
      setStatus(`Deleted ${mailbox.address}.`);
      await refresh(session, organization);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete mailbox.");
    }
  }

  function logout() {
    clearSession();
    router.replace("/login");
  }

  const readyDomains = domains.filter(isDomainReady);

  return (
    <AppShell
      currentSection="Mailboxes"
      navigation={customerNavigation(router)}
      quickActions={customerActions(() => setCreateOpen(true), router)}
      searchPlaceholder="Search mailboxes..."
      shellDescription="Business Workspace"
      shellTitle={organization?.name ?? "JPosta"}
      userEmail={session?.user.primaryEmail ?? session?.user.email ?? "owner@company.com"}
      userName={session?.user.name ?? "Workspace Admin"}
      workspace={organization?.name ?? "Business Workspace"}
      workspaceLabel="Mailboxes"
    >
      <div className="grid gap-4">
        <GlassCard className="p-4 sm:p-5" intensity="soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Mailbox className="mb-3 h-5 w-5 text-sky-600" aria-hidden="true" />
              <h1 className="text-2xl font-semibold text-foreground">Mailbox provisioning</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{status}</p>
              {error ? <p className="mt-2 text-sm text-rose-500">{error}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <GlassButton
                disabled={!organization || readyDomains.length === 0}
                onClick={() => setCreateOpen(true)}
                variant="primary"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create Mailbox
              </GlassButton>
              <GlassButton onClick={() => refresh()}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Refresh
              </GlassButton>
              <GlassButton variant="ghost" onClick={logout}>
                Logout
              </GlassButton>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-5" intensity="default">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Provisioned accounts</p>
              <h2 className="text-xl font-semibold text-foreground">Mailboxes</h2>
            </div>
            <GlassBadge tone="neutral">{mailboxes.length} total</GlassBadge>
          </div>
          <GlassDivider className="my-4" />
          {loading ? <p className="text-sm text-muted-foreground">Loading mailboxes...</p> : null}
          {!loading && mailboxes.length === 0 ? (
            <div className="rounded-2xl border border-glass-edge/24 bg-white/60 p-4 text-sm text-muted-foreground shadow-inner-glass">
              No mailboxes yet. Verify a domain, then create admin@golyvin.com.
            </div>
          ) : null}
          <div className="grid gap-3">
            {mailboxes.map((mailbox) => (
              <MailboxRow
                key={mailbox.id}
                mailbox={mailbox}
                onDelete={() => deleteMailbox(mailbox)}
                onResetPassword={() => resetPassword(mailbox)}
                onSuspend={() => suspendMailbox(mailbox)}
              />
            ))}
          </div>
        </GlassCard>
      </div>

      {createOpen ? (
        <CreateMailboxModal
          domains={readyDomains}
          loading={loading}
          onClose={() => setCreateOpen(false)}
          onSubmit={createMailbox}
        />
      ) : null}
    </AppShell>
  );
}

function MailboxRow({
  mailbox,
  onDelete,
  onResetPassword,
  onSuspend,
}: {
  mailbox: MailboxRecord;
  onDelete: () => void;
  onResetPassword: () => void;
  onSuspend: () => void;
}) {
  return (
    <div className="rounded-2xl border border-glass-edge/24 bg-white/64 p-4 shadow-inner-glass">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="break-all text-sm font-semibold text-foreground">{mailbox.address}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {mailbox.displayName || "No display name"} /{" "}
            {mailbox.domain?.name ?? domainFromAddress(mailbox.address)} / {mailbox.quotaMb} MB
          </p>
          {mailbox.provisioningError ? (
            <p className="mt-1 text-xs text-rose-500">{mailbox.provisioningError}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <GlassBadge tone={mailbox.type === "PERSONAL" ? "premium" : "neutral"}>
            {mailbox.type}
          </GlassBadge>
          <StatusBadge status={mailbox.status} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <GlassButton size="sm" onClick={onResetPassword}>
          Reset password
        </GlassButton>
        <GlassButton size="sm" onClick={onSuspend}>
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          Suspend
        </GlassButton>
        <GlassButton size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </GlassButton>
      </div>
    </div>
  );
}

function CreateMailboxModal({
  domains,
  loading,
  onClose,
  onSubmit,
}: {
  domains: Domain[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  const [domainId, setDomainId] = React.useState(domains[0]?.id ?? "");
  const [localPart, setLocalPart] = React.useState("admin");
  const selectedDomain = domains.find((domain) => domain.id === domainId);
  const address =
    selectedDomain && localPart
      ? `${localPart.trim().toLowerCase()}@${selectedDomain.name}`
      : "admin@golyvin.com";

  return (
    <Modal title="Create mailbox" onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(new FormData(event.currentTarget));
        }}
      >
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Verified domain
          <select
            className="h-11 rounded-control border border-input bg-white/80 px-3 text-sm text-foreground shadow-inner-glass"
            name="domainId"
            required
            value={domainId}
            onChange={(event) => setDomainId(event.target.value)}
          >
            {domains.map((domain) => (
              <option key={domain.id} value={domain.id}>
                {domain.name}
              </option>
            ))}
          </select>
        </label>
        <GlassInput
          name="localPart"
          placeholder="admin"
          required
          value={localPart}
          onChange={(event) => setLocalPart(event.target.value)}
        />
        <GlassInput name="displayName" placeholder="Admin" required />
        <GlassInput name="password" placeholder="Mailbox password" required type="password" />
        <GlassInput
          name="confirmPassword"
          placeholder="Confirm password"
          required
          type="password"
        />
        <GlassInput min={512} name="quotaMb" placeholder="5120" required type="number" />
        <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-3 text-sm text-sky-800 shadow-inner-glass">
          Complete address: <span className="font-semibold">{address}</span>
        </div>
        <GlassButton disabled={loading || domains.length === 0} type="submit" variant="primary">
          Create Mailbox
        </GlassButton>
      </form>
    </Modal>
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
      <div className="w-full max-w-lg rounded-[1.5rem] border border-glass-edge/32 bg-white/95 p-5 shadow-glass">
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

function StatusBadge({ status }: { status: MailboxRecord["status"] }) {
  return (
    <GlassBadge
      tone={
        status === "ACTIVE"
          ? "success"
          : status === "FAILED" || status === "SUSPENDED"
            ? "warning"
            : "neutral"
      }
    >
      {status}
    </GlassBadge>
  );
}

function isDomainReady(domain: Domain) {
  return domain.status === "VERIFIED" || domain.status === "ACTIVE";
}

function normalizeLocalPart(value: string) {
  const localPart = value.trim().toLowerCase();
  if (!/^[a-z0-9._-]{1,64}$/.test(localPart)) {
    throw new Error("Use a valid local part such as admin, support, or billing.");
  }
  return localPart;
}

function domainFromAddress(address: string) {
  return address.split("@")[1] ?? "Unknown domain";
}
