import { BadRequestException } from "@nestjs/common";
import { createHash } from "node:crypto";

import { buildDomainDnsRecords } from "./domain.utils";

export type ProviderDnsRecord = {
  content: string;
  id?: string | undefined;
  name: string;
  priority?: number | undefined;
  ttl?: number | undefined;
  type: string;
};

export type DnsPlanItem = {
  action: "CREATE" | "UPDATE" | "KEEP" | "CONFLICT";
  current: ProviderDnsRecord[];
  desired?: ProviderDnsRecord | undefined;
  key: "verification" | "mx" | "spf" | "dkim" | "dmarc";
  message: string;
};

export function buildDnsChangePlan(
  domain: {
    dkimPublicKey: string | null;
    dkimSelector: string;
    name: string;
    verificationToken: string;
  },
  records: ProviderDnsRecord[],
) {
  const desired = buildDomainDnsRecords(domain).map((record) => ({
    type: record.type,
    name: absoluteName(record.name, domain.name),
    content: record.value,
    priority: record.priority,
    ttl: 300,
  }));
  const [verification, mx, spf, dkim, dmarc] = desired;
  if (!verification || !mx || !spf || !dkim || !dmarc)
    throw new Error("DNS record template is incomplete.");

  const items: DnsPlanItem[] = [];
  items.push(singlePlan("verification", verification, matches(records, verification), true));

  const mxRecords = records.filter(
    (record) => record.type === "MX" && normalizeName(record.name) === normalizeName(domain.name),
  );
  const matchingMx = mxRecords.some((record) => sameValue(record, mx));
  items.push({
    key: "mx",
    action:
      matchingMx && mxRecords.length === 1 ? "KEEP" : mxRecords.length ? "CONFLICT" : "CREATE",
    current: mxRecords,
    desired: mx,
    message:
      matchingMx && mxRecords.length === 1
        ? "JPosta MX is already configured."
        : mxRecords.length
          ? "Existing MX records will be replaced and may change current mail routing."
          : "Add the JPosta mail exchanger.",
  });

  const spfRecords = records.filter(
    (record) =>
      record.type === "TXT" &&
      normalizeName(record.name) === normalizeName(domain.name) &&
      record.content.trim().toLowerCase().startsWith("v=spf1"),
  );
  if (spfRecords.length > 1) {
    throw new BadRequestException(
      "Multiple SPF records exist. Merge them manually before automation.",
    );
  }
  const currentSpf = spfRecords[0];
  const mergedSpf = currentSpf ? mergeSpf(currentSpf.content) : spf.content;
  const desiredSpf = { ...spf, content: mergedSpf };
  items.push({
    key: "spf",
    action: !currentSpf ? "CREATE" : currentSpf.content === mergedSpf ? "KEEP" : "UPDATE",
    current: spfRecords,
    desired: desiredSpf,
    message: currentSpf
      ? "Merge JPosta into the existing SPF policy."
      : "Add the JPosta SPF policy.",
  });

  items.push(singlePlan("dkim", dkim, matches(records, dkim), true));
  const dmarcRecords = matches(records, dmarc);
  items.push({
    key: "dmarc",
    action: dmarcRecords.length ? "KEEP" : "CREATE",
    current: dmarcRecords,
    desired: dmarcRecords.length ? undefined : dmarc,
    message: dmarcRecords.length
      ? "Keep the existing DMARC policy."
      : "Add JPosta's recommended DMARC policy.",
  });

  return {
    items,
    hasConflicts: items.some((item) => item.action === "CONFLICT"),
    sourceFingerprint: fingerprint(records),
  };
}

export function fingerprint(records: ProviderDnsRecord[]) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        records
          .map(({ name, type, content, priority, ttl }) => ({
            name: normalizeName(name),
            type,
            content,
            priority: priority ?? null,
            ttl: ttl ?? null,
          }))
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      ),
    )
    .digest("hex");
}

export function applyPlanToRecords(records: ProviderDnsRecord[], items: DnsPlanItem[]) {
  let next = [...records];
  for (const item of items) {
    if (item.action === "KEEP" || !item.desired) continue;
    const currentIds = new Set(item.current.map((record) => record.id).filter(Boolean));
    next = next.filter(
      (record) =>
        !(currentIds.has(record.id) || item.current.some((current) => sameRecord(current, record))),
    );
    next.push(item.desired);
  }
  return next;
}

function singlePlan(
  key: "verification" | "dkim",
  desired: ProviderDnsRecord,
  current: ProviderDnsRecord[],
  conflictOnUpdate: boolean,
): DnsPlanItem {
  const exact = current.some((record) => sameValue(record, desired));
  return {
    key,
    action: exact ? "KEEP" : current.length ? (conflictOnUpdate ? "CONFLICT" : "UPDATE") : "CREATE",
    current,
    desired,
    message: exact ? `${key} record is already configured.` : `Configure the JPosta ${key} record.`,
  };
}

function matches(records: ProviderDnsRecord[], desired: ProviderDnsRecord) {
  return records.filter(
    (record) =>
      record.type === desired.type && normalizeName(record.name) === normalizeName(desired.name),
  );
}

function sameValue(left: ProviderDnsRecord, right: ProviderDnsRecord) {
  return (
    left.content.replace(/\.$/, "").toLowerCase() === right.content.replace(/\.$/, "").toLowerCase()
  );
}

function sameRecord(left: ProviderDnsRecord, right: ProviderDnsRecord) {
  return (
    left.type === right.type &&
    normalizeName(left.name) === normalizeName(right.name) &&
    sameValue(left, right)
  );
}

function absoluteName(name: string, domain: string) {
  return name === "@" ? domain : `${name}.${domain}`;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/\.$/, "");
}

function mergeSpf(value: string) {
  if (/\binclude:_spf\.jposta\.com\b/i.test(value)) return value;
  const parts = value.trim().split(/\s+/);
  const allIndex = parts.findIndex((part) => /^[~?+-]all$/i.test(part));
  parts.splice(allIndex < 0 ? parts.length : allIndex, 0, "include:_spf.jposta.com");
  return parts.join(" ");
}
