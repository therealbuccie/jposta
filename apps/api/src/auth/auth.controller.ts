import { Body, Controller, Get, NotImplementedException, Post, Query, Req } from "@nestjs/common";

import { AuthService } from "./auth.service";

type RequestLike = {
  ip?: string;
  socket?: { remoteAddress?: string };
};

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("username-availability")
  usernameAvailability(
    @Query("username") username: string | undefined,
    @Req() request: RequestLike,
  ) {
    return this.authService.usernameAvailability(username, clientKey(request, username));
  }

  @Post("register")
  register(@Body() body: unknown, @Req() request: RequestLike) {
    return this.authService.register(
      body as {
        confirmPassword?: string;
        fullName?: string;
        password?: string;
        recoveryEmail?: string;
        username?: string;
      },
      clientKey(request, "register"),
    );
  }

  @Post("login")
  login(@Body() body: unknown, @Req() request: RequestLike) {
    return this.authService.login(
      body as {
        identifier?: string;
        password?: string;
      },
      clientKey(request, "login"),
    );
  }

  @Post("recovery/verify")
  verifyRecoveryEmail() {
    throw new NotImplementedException(
      "Recovery email verification delivery is not implemented yet.",
    );
  }

  @Post("password-reset/request")
  requestPasswordReset() {
    throw new NotImplementedException("Password reset delivery is not implemented yet.");
  }
}

function clientKey(request: RequestLike, suffix: string | undefined) {
  return `${request.ip ?? request.socket?.remoteAddress ?? "anonymous"}:${suffix ?? ""}`;
}
