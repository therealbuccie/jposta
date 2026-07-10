import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

import { WebmailSessionService } from "./webmail-session.service";

export type WebmailRequest = {
  headers: Record<string, string | string[] | undefined>;
  webmailSession: Awaited<ReturnType<WebmailSessionService["getSession"]>>;
};

@Injectable()
export class WebmailSessionGuard implements CanActivate {
  constructor(private readonly sessions: WebmailSessionService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<WebmailRequest>();
    const header = request.headers.authorization;
    const authorization = Array.isArray(header) ? header[0] : header;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;

    if (!token) {
      throw new UnauthorizedException("Webmail session required.");
    }

    request.webmailSession = await this.sessions.getSession(token);
    return true;
  }
}
