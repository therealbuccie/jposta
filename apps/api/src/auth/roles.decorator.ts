import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "@prisma/client";

export const rolesMetadataKey = "jposta:roles";

export function Roles(...roles: UserRole[]) {
  return SetMetadata(rolesMetadataKey, roles);
}
