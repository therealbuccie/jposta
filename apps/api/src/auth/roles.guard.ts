import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@prisma/client";

import type { RequestWithUser } from "./auth.types";
import { rolesMetadataKey } from "./roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(rolesMetadataKey, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (!roles.includes(request.user.role)) {
      throw new ForbiddenException("You do not have access to this JPosta operation.");
    }

    return true;
  }
}
