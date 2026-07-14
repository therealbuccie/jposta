import { BadRequestException } from "@nestjs/common";
import { randomBytes } from "node:crypto";

export type DnsRecord = {
  name: string;
  priority?: number;
  type: "A" | "TXT" | "MX";
  value: string;
};

export type DomainDnsConfig = {
  mailHostname: string;
  mailServerIp?: string;
  spfInclude: string;
};

export function normalizeDomainName(value: string | undefined) {
  const domain = value?.trim().toLowerCase().replace(/\.$/, "");

  if (
    !domain ||
    domain.length > 253 ||
    domain.includes("..") ||
    !/^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(domain) ||
    domain.split(".").some((label) => label.endsWith("-"))
  ) {
    throw new BadRequestException("A valid domain name is required.");
  }

  return domain;
}

export function createVerificationToken() {
  return randomBytes(24).toString("hex");
}

export function buildDomainDnsRecords(input: {
  config?: DomainDnsConfig;
  dkimPublicKey: string | null;
  dkimSelector: string;
  name: string;
  verificationToken: string;
}): DnsRecord[] {
  const config = input.config ?? domainDnsConfigFromEnv();
  const records: DnsRecord[] = [
    {
      type: "TXT",
      name: "_jposta-verification",
      value: `jposta-verification=${input.verificationToken}`,
    },
    {
      type: "MX",
      name: "@",
      value: config.mailHostname,
      priority: 10,
    },
    {
      type: "TXT",
      name: "@",
      value: `v=spf1 include:${config.spfInclude} ~all`,
    },
    {
      type: "TXT",
      name: `${input.dkimSelector}._domainkey`,
      value: input.dkimPublicKey || "DKIM key generation pending",
    },
    {
      type: "TXT",
      name: "_dmarc",
      value: `v=DMARC1; p=none; rua=mailto:dmarc@${input.name}`,
    },
  ];

  if (config.mailServerIp) {
    records.push({
      type: "A",
      name: "mail",
      value: config.mailServerIp,
    });
  }

  return records;
}

export function domainDnsConfigFromEnv(): DomainDnsConfig {
  const mailServerIp = normalizeConfigValue(process.env.MAIL_SERVER_IP);

  return {
    mailHostname: requireConfigValue(process.env.MAIL_HOSTNAME, "MAIL_HOSTNAME"),
    ...(mailServerIp ? { mailServerIp } : {}),
    spfInclude: requireConfigValue(process.env.SPF_INCLUDE_HOST, "SPF_INCLUDE_HOST"),
  };
}

function requireConfigValue(value: string | undefined, name: string) {
  const normalized = normalizeConfigValue(value);
  if (!normalized) throw new Error(`${name} must be configured.`);
  return normalized;
}

function normalizeConfigValue(value: string | undefined) {
  const normalized = value?.trim().replace(/\.$/, "");
  return normalized || undefined;
}
