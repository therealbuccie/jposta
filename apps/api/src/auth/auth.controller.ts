import { Body, Controller, Post } from "@nestjs/common";

import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() body: unknown) {
    return this.authService.register(body as { email?: string; name?: string; password?: string });
  }

  @Post("login")
  login(@Body() body: unknown) {
    return this.authService.login(body as { email?: string; password?: string });
  }
}
