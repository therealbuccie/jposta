export type AuthenticatedUser = {
  email: string;
  id: string;
  name: string;
};

export type RequestWithUser = {
  user: AuthenticatedUser;
};
