import { env } from "@/lib/env";

export type ApiUser = {
  email: string;
  id: string;
  name: string;
  primaryEmail: string;
  role: "USER" | "WORKSPACE_OWNER" | "WORKSPACE_ADMIN" | "PLATFORM_ADMIN" | "SUPPORT_AGENT";
  status: "PENDING_PROVISIONING" | "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "FAILED";
  username: string;
};

export type AuthSession = {
  accessToken?: string;
  accountStatus?: ApiUser["status"];
  primaryEmail?: string;
  token: string;
  user: ApiUser;
  warning?: string;
};

export type PortalInfo = {
  organizationName: string;
  portalDisplayName?: string | null;
  portalLogoUrl?: string | null;
  portalStatus: "ACTIVE" | "DISABLED";
  portalWelcomeMessage?: string | null;
  slug: string;
};

export type WebmailMe = {
  mailbox: { address: string; displayName: string; status: string };
  portal: { displayName: string; logoUrl?: string | null; organizationName: string; slug: string };
};

export type WebmailLogin = {
  mailbox: { address: string; displayName: string };
  portal: { displayName: string; slug: string };
  redirectTo: string;
  webmailSessionToken: string;
};

export type UsernameAvailability = {
  available: boolean;
  email: string;
  normalizedUsername: string;
  suggestions: string[];
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
};

export type Domain = {
  id: string;
  name: string;
  organization?: { id: string; name: string };
  organizationId?: string;
  status: "PENDING" | "VERIFYING" | "VERIFIED" | "ACTIVE" | "FAILED";
  verificationError?: string | null;
};

export type DnsRecord = {
  name: string;
  priority?: number;
  type: "TXT" | "MX";
  value: string;
};

export type VerifyResult = {
  checks: Record<string, { actual: string[]; expected: string; passed: boolean }>;
  verified: boolean;
};

export type MailboxRecord = {
  address: string;
  displayName: string;
  domain?: Domain | null;
  id: string;
  provisioningError?: string | null;
  quotaMb: number;
  status: "PENDING" | "PROVISIONING" | "ACTIVE" | "FAILED" | "SUSPENDED";
  type: "PERSONAL" | "BUSINESS";
};

type ApiOptions = {
  body?: Record<string, unknown>;
  method?: "DELETE" | "GET" | "PATCH" | "POST";
  token?: string;
};

export async function apiRequest<T>(path: string, options: ApiOptions = {}) {
  const requestInit: RequestInit = {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
  };

  if (options.body) {
    requestInit.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${env.apiUrl}${path}`, requestInit);
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;

  if (!response.ok) {
    throw new Error(
      (payload as { message?: string } | null)?.message ||
        `Request failed with ${response.status}.`,
    );
  }

  return payload as T;
}

export const jpostaApi = {
  getPortal: (slug: string) => apiRequest<PortalInfo>(`/public/portal/${encodeURIComponent(slug)}`),
  webmailLogin: (body: { email: string; password: string; portalSlug: string }) =>
    apiRequest<WebmailLogin>("/webmail/auth/login", { body }),
  webmailMe: (token: string) => apiRequest<WebmailMe>("/webmail/me", { token }),
  webmailLogout: (token: string) =>
    apiRequest<{ revoked: boolean }>("/webmail/logout", { token, body: {} }),
  usernameAvailability: (username: string) =>
    apiRequest<UsernameAvailability>(
      `/auth/username-availability?username=${encodeURIComponent(username)}`,
    ),
  register: (body: {
    confirmPassword: string;
    fullName: string;
    password: string;
    recoveryEmail?: string;
    username: string;
  }) => apiRequest<AuthSession>("/auth/register", { body }),
  login: (body: { identifier: string; password: string }) =>
    apiRequest<AuthSession>("/auth/login", { body }),
  listOrganizations: (token: string) => apiRequest<Organization[]>("/organizations", { token }),
  createOrganization: (token: string, body: { name: string }) =>
    apiRequest<Organization>("/organizations", { token, body }),
  listDomains: (token: string) => apiRequest<Domain[]>("/domains", { token }),
  createDomain: (token: string, body: { name: string; organizationId: string }) =>
    apiRequest<Domain>("/domains", { token, body }),
  getDomain: (token: string, id: string) => apiRequest<Domain>(`/domains/${id}`, { token }),
  getDomainDnsRecords: (token: string, id: string) =>
    apiRequest<{ domain: string; records: DnsRecord[] }>(`/domains/${id}/dns-records`, { token }),
  verifyDomain: (token: string, id: string) =>
    apiRequest<VerifyResult>(`/domains/${id}/verify`, { token, body: {} }),
  listMailboxes: (token: string) => apiRequest<MailboxRecord[]>("/mailboxes", { token }),
  createMailbox: (
    token: string,
    body: {
      displayName: string;
      domainId: string;
      localPart: string;
      organizationId: string;
      password: string;
      quotaMb: number;
    },
  ) => apiRequest<MailboxRecord>("/mailboxes", { token, body }),
  resetMailboxPassword: (token: string, id: string, password: string) =>
    apiRequest<MailboxRecord>(`/mailboxes/${id}/password`, {
      method: "PATCH",
      token,
      body: { password },
    }),
  suspendMailbox: (token: string, id: string) =>
    apiRequest<MailboxRecord>(`/mailboxes/${id}/suspend`, { method: "PATCH", token, body: {} }),
  deleteMailbox: (token: string, id: string) =>
    apiRequest<{ deleted: boolean }>(`/mailboxes/${id}`, { method: "DELETE", token }),
};
