import { BadRequestException } from "@nestjs/common";
import { randomBytes } from "node:crypto";

export type DnsRecord = {
  name: string;
  priority?: number;
  type: "TXT" | "MX";
  value: string;
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
  dkimPublicKey: string | null;
  dkimSelector: string;
  name: string;
  verificationToken: string;
}): DnsRecord[] {
  return [
    {
      type: "TXT",
      name: "_jposta-verification",
      value: `jposta-verification=${input.verificationToken}`,
    },
    {
      type: "MX",
      name: "@",
      value: "mail.jposta.com",
      priority: 10,
    },
    {
      type: "TXT",
      name: "@",
      value: "v=spf1 include:_spf.jposta.com ~all",
    },
    {
      type: "TXT",
      name: `${input.dkimSelector}._domainkey`,
      value: input.dkimPublicKey || "DKIM key generation pending",
    },
    {
      type: "TXT",
      name: "_dmarc",
      value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@jposta.com",
    },
  ];
}
