import { env } from "@/lib/env";

export type ApiUser = {
  email: string;
  id: string;
  name: string;
};

export type AuthSession = {
  token: string;
  user: ApiUser;
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
  domain?: Domain;
  id: string;
  provisioningError?: string | null;
  quotaMb: number;
  status: "PENDING" | "PROVISIONING" | "ACTIVE" | "FAILED" | "SUSPENDED";
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
  register: (body: { email: string; name: string; password: string }) =>
    apiRequest<AuthSession>("/auth/register", { body }),
  login: (body: { email: string; password: string }) =>
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
