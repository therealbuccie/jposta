"use client";

import * as React from "react";
import { Inbox, Mailbox, ShieldCheck, Sparkles } from "lucide-react";

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

import { env } from "@/lib/env";

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

type ApiUser = {
  email: string;
  id: string;
  name: string;
};

type ApiOrganization = {
  id: string;
  name: string;
  slug: string;
};

type ApiDomain = {
  id: string;
  name: string;
  status: string;
};

type ApiMailbox = {
  address: string;
  displayName: string;
  id: string;
};

type AuthSession = {
  token: string;
  user: ApiUser;
};

export function BusinessWorkspaceClient() {
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [organization, setOrganization] = React.useState<ApiOrganization | null>(null);
  const [domain, setDomain] = React.useState<ApiDomain | null>(null);
  const [mailbox, setMailbox] = React.useState<ApiMailbox | null>(null);
  const [status, setStatus] = React.useState("Ready to connect to JPosta API.");
  const [loading, setLoading] = React.useState(false);

  async function submitRegister(formData: FormData) {
    const response = await apiRequest<AuthSession>("/auth/register", {
      email: formData.get("email"),
      name: formData.get("name"),
      password: formData.get("password"),
    });
    setSession(response);
    setStatus(`Registered ${response.user.email}. JWT session is active.`);
  }

  async function submitLogin(formData: FormData) {
    const response = await apiRequest<AuthSession>("/auth/login", {
      email: formData.get("email"),
      password: formData.get("password"),
    });
    setSession(response);
    setStatus(`Logged in as ${response.user.email}.`);
  }

  async function submitOrganization(formData: FormData) {
    const created = await apiRequest<ApiOrganization>(
      "/organizations",
      {
        name: formData.get("name"),
        slug: formData.get("slug"),
      },
      session?.token,
    );
    setOrganization(created);
    setDomain(null);
    setMailbox(null);
    setStatus(`Created organization ${created.name}.`);
  }

  async function submitDomain(formData: FormData) {
    const created = await apiRequest<ApiDomain>(
      "/domains",
      {
        organizationId: organization?.id,
        name: formData.get("name"),
      },
      session?.token,
    );
    setDomain(created);
    setMailbox(null);
    setStatus(`Added domain ${created.name}.`);
  }

  async function submitMailbox(formData: FormData) {
    const created = await apiRequest<ApiMailbox>(
      "/mailboxes",
      {
        organizationId: organization?.id,
        domainId: domain?.id,
        localPart: formData.get("localPart"),
        displayName: formData.get("displayName"),
      },
      session?.token,
    );
    setMailbox(created);
    setStatus(`Created mailbox ${created.address}.`);
  }

  async function handleAction(action: (formData: FormData) => Promise<void>, formData: FormData) {
    setLoading(true);
    try {
      await action(formData);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  const mailboxRows = [
    [
      mailbox?.address ?? "support@36t.studio",
      mailbox ? "Persisted mailbox from PostgreSQL" : "Shared customer mailbox",
    ],
    [
      domain?.name ?? "billing@36t.studio",
      domain ? `Domain status: ${domain.status}` : "Invoice and subscription notices",
    ],
    [
      organization?.name ?? "hello@36t.studio",
      organization ? "Persisted organization workspace" : "Public company address",
    ],
  ] as const;

  return (
    <AppShell
      currentSection="Inbox"
      navigation={businessNavigation}
      quickActions={businessActions}
      searchPlaceholder="Search company mail, domains, contacts..."
      shellDescription="Business Workspace"
      shellTitle="36T Studios"
      userEmail={session?.user.email ?? "owner@36t.studio"}
      userName={session?.user.name ?? "Workspace Admin"}
      workspace={organization?.name ?? "36T Studios"}
      workspaceLabel="Business Workspace"
    >
      <div className="grid gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <GlassBadge tone="premium">Business Workspace</GlassBadge>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal text-foreground md:text-4xl">
              Company email operations for {organization?.name ?? "36T Studios"}.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Manage the company inbox, team mailboxes, domains, aliases, distribution lists,
              contacts, files, billing, and workspace settings from one crystal-clear command
              center.
            </p>
          </div>
          <StatusIndicator label={session ? "API session active" : "Company mail healthy"} />
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
              <Sparkles className="mb-4 h-5 w-5 text-sky-600" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-foreground">Connect to PostgreSQL</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{status}</p>
              <GlassDivider className="my-4" />
              <div className="grid gap-3">
                <BackendForm
                  buttonLabel="Register user"
                  disabled={loading}
                  fields={[
                    ["name", "Name", "Workspace Admin"],
                    ["email", "Email", "owner@36t.studio"],
                    ["password", "Password", "supersecure123"],
                  ]}
                  onSubmit={(formData) => handleAction(submitRegister, formData)}
                />
                <BackendForm
                  buttonLabel="Login user"
                  disabled={loading}
                  fields={[
                    ["email", "Email", "owner@36t.studio"],
                    ["password", "Password", "supersecure123"],
                  ]}
                  onSubmit={(formData) => handleAction(submitLogin, formData)}
                />
              </div>
            </GlassCard>
            <GlassCard className="p-5" intensity="soft">
              <ShieldCheck className="mb-4 h-5 w-5 text-emerald-600" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-foreground">Provision workspace data</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Create an organization, add a domain, then create a mailbox. Each step persists
                through the NestJS API.
              </p>
              <GlassDivider className="my-4" />
              <div className="grid gap-3">
                <BackendForm
                  buttonLabel="Create organization"
                  disabled={loading || !session}
                  fields={[
                    ["name", "Organization name", "36T Studios"],
                    ["slug", "Slug", "36t-studios"],
                  ]}
                  onSubmit={(formData) => handleAction(submitOrganization, formData)}
                />
                <BackendForm
                  buttonLabel="Add domain"
                  disabled={loading || !session || !organization}
                  fields={[["name", "Domain", "36t.studio"]]}
                  onSubmit={(formData) => handleAction(submitDomain, formData)}
                />
                <BackendForm
                  buttonLabel="Create mailbox"
                  disabled={loading || !session || !organization || !domain}
                  fields={[
                    ["localPart", "Address", "support"],
                    ["displayName", "Display name", "Support Team"],
                  ]}
                  onSubmit={(formData) => handleAction(submitMailbox, formData)}
                />
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function BackendForm({
  buttonLabel,
  disabled,
  fields,
  onSubmit,
}: {
  buttonLabel: string;
  disabled?: boolean;
  fields: Array<readonly [name: string, label: string, placeholder: string]>;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <form
      className="grid gap-2 rounded-2xl border border-glass-edge/24 bg-white/56 p-3 shadow-inner-glass"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
      }}
    >
      {fields.map(([name, label, placeholder]) => (
        <label className="grid gap-1 text-xs font-medium text-muted-foreground" key={name}>
          {label}
          <GlassInput
            className="h-10 bg-white/88"
            name={name}
            placeholder={placeholder}
            type={name === "password" ? "password" : "text"}
          />
        </label>
      ))}
      <GlassButton
        className="mt-1 justify-center"
        disabled={disabled}
        type="submit"
        variant="glass"
      >
        {buttonLabel}
      </GlassButton>
    </form>
  );
}

async function apiRequest<T>(
  path: string,
  body: Record<string, FormDataEntryValue | null | undefined>,
  token?: string,
) {
  const response = await fetch(`${env.apiUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as { message?: string } | T | null;

  if (!response.ok) {
    throw new Error((payload as { message?: string } | null)?.message || "API request failed.");
  }

  return payload as T;
}
