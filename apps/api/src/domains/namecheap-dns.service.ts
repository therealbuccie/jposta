import { BadGatewayException, BadRequestException, Injectable } from "@nestjs/common";

import { env } from "../config/env";
import { applyPlanToRecords, type DnsPlanItem, type ProviderDnsRecord } from "./dns-change-plan";

export type NamecheapCredentials = { apiKey: string; apiUser: string };

@Injectable()
export class NamecheapDnsService {
  configuration() {
    return { clientIp: env.namecheapClientIp, configured: Boolean(env.namecheapClientIp) };
  }

  async listRecords(domain: string, credentials: NamecheapCredentials) {
    const { sld, tld } = await this.domainParts(domain, credentials);
    const xml = await this.call("namecheap.domains.dns.getHosts", credentials, {
      SLD: sld,
      TLD: tld,
    });
    const hosts = [...xml.matchAll(/<host\b([^>]*)\/?\s*>/gi)];
    return hosts.map((match) => {
      const attributes = parseAttributes(match[1] ?? "");
      return {
        id: attributes.HostId,
        name: absoluteName(attributes.Name || "@", domain),
        type: attributes.Type || "TXT",
        content: decodeXml(attributes.Address || ""),
        priority: attributes.MXPref ? Number(attributes.MXPref) : undefined,
        ttl: attributes.TTL ? Number(attributes.TTL) : undefined,
      } satisfies ProviderDnsRecord;
    });
  }

  async applyPlan(
    domain: string,
    credentials: NamecheapCredentials,
    current: ProviderDnsRecord[],
    items: DnsPlanItem[],
  ) {
    const { sld, tld } = await this.domainParts(domain, credentials);
    const records = applyPlanToRecords(current, items);
    const values: Record<string, string> = { SLD: sld, TLD: tld, EmailType: "MX" };
    records.forEach((record, index) => {
      const suffix = String(index + 1);
      values[`HostName${suffix}`] = relativeName(record.name, domain);
      values[`RecordType${suffix}`] = record.type;
      values[`Address${suffix}`] = record.content;
      values[`TTL${suffix}`] = String(record.ttl ?? 300);
      if (record.type === "MX") values[`MXPref${suffix}`] = String(record.priority ?? 10);
    });
    await this.call("namecheap.domains.dns.setHosts", credentials, values);
  }

  private async domainParts(domain: string, credentials: NamecheapCredentials) {
    const xml = await this.call("namecheap.domains.getTldList", credentials, {});
    const tlds = [...xml.matchAll(/<Tld\b[^>]*\bName="([^"]+)"/gi)].map((match) =>
      decodeXml(match[1] ?? "").toLowerCase(),
    );
    const tld = tlds
      .filter((candidate) => domain.endsWith(`.${candidate}`))
      .sort((a, b) => b.length - a.length)[0];
    if (!tld) throw new BadRequestException("Namecheap does not recognize this domain suffix.");
    const sld = domain.slice(0, -(tld.length + 1));
    if (!sld || sld.includes("."))
      throw new BadRequestException("Namecheap hosted zone could not be determined.");
    return { sld, tld };
  }

  private async call(
    command: string,
    credentials: NamecheapCredentials,
    values: Record<string, string>,
  ) {
    if (!env.namecheapClientIp) {
      throw new BadRequestException(
        "NAMECHEAP_CLIENT_IP must be configured before connecting Namecheap.",
      );
    }
    const body = new URLSearchParams({
      ApiUser: credentials.apiUser,
      ApiKey: credentials.apiKey,
      UserName: credentials.apiUser,
      ClientIp: env.namecheapClientIp,
      Command: command,
      ...values,
    });
    const response = await fetch(env.namecheapApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const xml = await response.text();
    const errors = [...xml.matchAll(/<Error\b[^>]*>([\s\S]*?)<\/Error>/gi)].map((match) =>
      decodeXml((match[1] ?? "").trim()),
    );
    if (!response.ok || /Status="ERROR"/i.test(xml) || errors.length) {
      throw new BadGatewayException(
        errors.join("; ") || `Namecheap request failed with status ${response.status}.`,
      );
    }
    return xml;
  }
}

function parseAttributes(value: string) {
  const result: Record<string, string> = {};
  for (const match of value.matchAll(/([A-Za-z0-9]+)="([^"]*)"/g)) {
    if (match[1]) result[match[1]] = decodeXml(match[2] ?? "");
  }
  return result;
}

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function absoluteName(name: string, domain: string) {
  return name === "@" ? domain : `${name.replace(/\.$/, "")}.${domain}`;
}

function relativeName(name: string, domain: string) {
  const normalized = name.replace(/\.$/, "").toLowerCase();
  return normalized === domain
    ? "@"
    : normalized.endsWith(`.${domain}`)
      ? normalized.slice(0, -(domain.length + 1))
      : normalized;
}
