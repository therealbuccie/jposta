import { Module } from "@nestjs/common";

import { PublicPortalController } from "./public-portal.controller";
import { PublicPortalService } from "./public-portal.service";

@Module({
  controllers: [PublicPortalController],
  providers: [PublicPortalService],
})
export class PublicPortalModule {}
