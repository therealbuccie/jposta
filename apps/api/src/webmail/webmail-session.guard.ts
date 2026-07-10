import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

import { WebmailService } from "./webmail.service";

export type WebmailRequest = {
  webmailSession: Awaited<ReturnType<WebmailService["getSession"]>>;
  headers: Record<string, string | string[] | undefined>;
};

@Injectable()
export class WebmailSessionGuard implements CanActivate {
  constructor(private readonly webmailService: WebmailService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<WebmailRequest>();
    const header = request.headers.authorization;
    const authorization = Array.isArray(header) ? header[0] : header;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;

    if (!token) {
      throw new UnauthorizedException("Webmail session required.");
    }

    request.webmailSession = await this.webmailService.getSession(token);
    return true;
  }
}
