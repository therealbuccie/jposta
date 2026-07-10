import { Injectable } from "@nestjs/common";
import { promises as dns } from "node:dns";

export type DnsCheck = {
  actual: string[];
  expected: string;
  passed: boolean;
};

export type DomainVerificationResult = {
  checks: {
    dkim: DnsCheck;
    mx: DnsCheck;
    spf: DnsCheck;
    verification: DnsCheck;
  };
  verified: boolean;
};

@Injectable()
export class DomainVerificationService {
  async verify(input: {
    dkimPublicKey: string | null;
    dkimSelector: string;
    name: string;
    verificationToken: string;
  }): Promise<DomainVerificationResult> {
    const verificationExpected = `jposta-verification=${input.verificationToken}`;
    const mxExpected = "mail.jposta.com";
    const spfExpected = "include:_spf.jposta.com";
    const dkimExpected = input.dkimPublicKey || "DKIM TXT record";

    const verificationTxt = await resolveTxt(
      `_jposta-verification.${input.name}`,
    );

    const mxRecords = await resolveMx(input.name);
    const rootTxt = await resolveTxt(input.name);

    const dkimTxt = await resolveTxt(
      `${input.dkimSelector}._domainkey.${input.name}`,
    );

    const checks = {
      verification: {
        expected: verificationExpected,
        actual: verificationTxt,
        passed: verificationTxt.some(
          (record) => record === verificationExpected,
        ),
      },
      mx: {
        expected: mxExpected,
        actual: mxRecords,
        passed: mxRecords.some(
          (record) => record.toLowerCase() === mxExpected,
        ),
      },
      spf: {
        expected: spfExpected,
        actual: rootTxt,
        passed: rootTxt.some((record) =>
          record.toLowerCase().includes(spfExpected),
        ),
      },
      dkim: {
        expected: dkimExpected,
        actual: dkimTxt,
        passed: dkimTxt.length > 0,
      },
    };

    return {
      checks,
      verified: Object.values(checks).every((check) => check.passed),
    };
  }
}

async function resolveTxt(hostname: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(hostname);
    return records.map((record) => record.join(""));
  } catch {
    return [];
  }
}

async function resolveMx(hostname: string): Promise<string[]> {
  try {
    const records = await dns.resolveMx(hostname);
    return records.map((record) => record.exchange.replace(/\.$/, ""));
  } catch {
    return [];
  }
}