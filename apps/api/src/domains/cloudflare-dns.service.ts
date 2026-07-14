import { BadGatewayException, Injectable } from "@nestjs/common";

import type { DnsPlanItem, ProviderDnsRecord } from "./dns-change-plan";

type CloudflareCredentials = { accessToken: string; refreshToken?: string };
type CloudflareEnvelope<T> = {
  errors?: Array<{ message?: string }>;
  result?: T;
  success?: boolean;
};

@Injectable()
export class CloudflareDnsService {
  async findZone(accessToken: string, domain: string) {
    const response = await this.request<Array<{ id: string; name: string }>>(
      `/zones?name=${encodeURIComponent(domain)}&status=active&per_page=50`,
      accessToken,
    );
    return response.find((zone) => zone.name.toLowerCase() === domain.toLowerCase()) ?? null;
  }

  async listRecords(
    connection: { externalZoneId: string | null },
    credentials: CloudflareCredentials,
  ) {
    if (!connection.externalZoneId) throw new BadGatewayException("Cloudflare zone is missing.");
    const records = await this.request<
      Array<{
        content: string;
        id: string;
        name: string;
        priority?: number;
        ttl: number;
        type: string;
      }>
    >(`/zones/${connection.externalZoneId}/dns_records?per_page=5000`, credentials.accessToken);
    return records.map((record) => ({
      id: record.id,
      name: record.name,
      type: record.type,
      content: record.content,
      priority: record.priority,
      ttl: record.ttl,
    }));
  }

  async applyPlan(
    connection: { externalZoneId: string | null },
    credentials: CloudflareCredentials,
    items: DnsPlanItem[],
  ) {
    if (!connection.externalZoneId) throw new BadGatewayException("Cloudflare zone is missing.");
    const deletes = items
      .filter((item) => item.action !== "KEEP")
      .flatMap((item) => item.current)
      .flatMap((record) => (record.id ? [{ id: record.id }] : []));
    const posts = items
      .filter((item) => item.action !== "KEEP" && item.desired)
      .map((item) => toCloudflareRecord(item.desired!));

    await this.request(
      `/zones/${connection.externalZoneId}/dns_records/batch`,
      credentials.accessToken,
      {
        method: "POST",
        body: JSON.stringify({ deletes, posts, patches: [], puts: [] }),
      },
    );
  }

  async revoke(accessToken: string) {
    const body = new URLSearchParams({ token: accessToken });
    await fetch("https://dash.cloudflare.com/oauth2/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }).catch(() => undefined);
  }

  private async request<T = unknown>(path: string, accessToken: string, init: RequestInit = {}) {
    const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    const payload = (await response.json().catch(() => null)) as CloudflareEnvelope<T> | null;
    if (!response.ok || !payload?.success) {
      throw new BadGatewayException(
        payload?.errors
          ?.map((error) => error.message)
          .filter(Boolean)
          .join("; ") || `Cloudflare request failed with status ${response.status}.`,
      );
    }
    return payload.result as T;
  }
}

function toCloudflareRecord(record: ProviderDnsRecord) {
  return {
    type: record.type,
    name: record.name,
    content: record.content,
    ttl: record.ttl ?? 300,
    ...(record.type === "MX" ? { priority: record.priority ?? 10 } : {}),
  };
}
