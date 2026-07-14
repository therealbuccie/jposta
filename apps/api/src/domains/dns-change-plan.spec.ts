import { BadRequestException } from "@nestjs/common";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyPlanToRecords, buildDnsChangePlan, type ProviderDnsRecord } from "./dns-change-plan";

const domain = {
  name: "example.com",
  verificationToken: "token",
  dkimSelector: "mail",
  dkimPublicKey: "v=DKIM1; k=rsa; p=key",
};

describe("DNS provider change planning", () => {
  it("plans a clean zone without destructive conflicts", () => {
    const plan = buildDnsChangePlan(domain, []);

    assert.equal(plan.hasConflicts, false);
    assert.deepEqual(
      plan.items.map((item) => item.action),
      ["CREATE", "CREATE", "CREATE", "CREATE", "CREATE"],
    );
  });

  it("merges SPF and flags existing mail routing for confirmation", () => {
    const records: ProviderDnsRecord[] = [
      { id: "mx", type: "MX", name: "example.com", content: "mail.old.test", priority: 10 },
      { id: "spf", type: "TXT", name: "example.com", content: "v=spf1 include:old.test -all" },
      { id: "dmarc", type: "TXT", name: "_dmarc.example.com", content: "v=DMARC1; p=reject" },
    ];
    const plan = buildDnsChangePlan(domain, records);

    assert.equal(plan.hasConflicts, true);
    assert.equal(plan.items.find((item) => item.key === "mx")?.action, "CONFLICT");
    assert.equal(
      plan.items.find((item) => item.key === "spf")?.desired?.content,
      "v=spf1 include:old.test include:_spf.jposta.com -all",
    );
    assert.equal(plan.items.find((item) => item.key === "dmarc")?.action, "KEEP");
    const next = applyPlanToRecords(records, plan.items);
    assert.ok(next.some((record) => record.content === "v=DMARC1; p=reject"));
    assert.ok(!next.some((record) => record.content === "mail.old.test"));
  });

  it("blocks automation when multiple SPF policies exist", () => {
    assert.throws(
      () =>
        buildDnsChangePlan(domain, [
          { type: "TXT", name: "example.com", content: "v=spf1 -all" },
          { type: "TXT", name: "example.com", content: "v=spf1 ~all" },
        ]),
      BadRequestException,
    );
  });
});
