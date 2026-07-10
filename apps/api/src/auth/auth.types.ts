import type { UserRole, UserStatus } from "@prisma/client";

export type AuthenticatedUser = {
  email: string;
  id: string;
  name: string;
  primaryEmail: string;
  role: UserRole;
  status: UserStatus;
  username: string;
};

export type RequestWithUser = {
  user: AuthenticatedUser;
};
