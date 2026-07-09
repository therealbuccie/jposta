import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

import { AuthService } from "./auth.service";
import type { RequestWithUser } from "./auth.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithUser & { headers: Record<string, string | string[] | undefined> }>();
    const authorization = request.headers.authorization;
    const token = Array.isArray(authorization) ? authorization[0] : authorization;

    if (!token?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    request.user = this.authService.verifyToken(token.slice("Bearer ".length));
    return true;
  }
}
