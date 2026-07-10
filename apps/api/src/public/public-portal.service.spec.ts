import { NotFoundException } from "@nestjs/common";
import { PortalStatus } from "@prisma/client";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PublicPortalService } from "./public-portal.service";

describe("PublicPortalService", () => {
  it("returns only safe portal branding", async () => {
    const service = new PublicPortalService({
      organization: {
        findUnique: async () => ({
          name: "Golivyn",
          slug: "golivyn",
          mailPortalEnabled: true,
          portalDisplayName: "Golivyn Mail",
          portalLogoUrl: "https://cdn.example/logo.png",
          portalWelcomeMessage: "Welcome",
          portalStatus: PortalStatus.ACTIVE,
        }),
      },
    } as never);

    assert.deepEqual(await service.getPortal("golivyn"), {
      slug: "golivyn",
      organizationName: "Golivyn",
      portalDisplayName: "Golivyn Mail",
      portalLogoUrl: "https://cdn.example/logo.png",
      portalWelcomeMessage: "Welcome",
      portalStatus: PortalStatus.ACTIVE,
    });
  });

  it("rejects disabled portals", async () => {
    const service = new PublicPortalService({
      organization: {
        findUnique: async () => ({
          name: "Golivyn",
          slug: "golivyn",
          mailPortalEnabled: false,
          portalDisplayName: null,
          portalLogoUrl: null,
          portalWelcomeMessage: null,
          portalStatus: PortalStatus.DISABLED,
        }),
      },
    } as never);

    await assert.rejects(() => service.getPortal("golivyn"), NotFoundException);
  });
});
