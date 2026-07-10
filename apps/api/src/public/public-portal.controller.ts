import { Controller, Get, Param } from "@nestjs/common";

import { PublicPortalService } from "./public-portal.service";

@Controller("public/portal")
export class PublicPortalController {
  constructor(private readonly publicPortalService: PublicPortalService) {}

  @Get(":slug")
  getPortal(@Param("slug") slug: string) {
    return this.publicPortalService.getPortal(slug);
  }
}
