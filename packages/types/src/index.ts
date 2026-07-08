export type EnvironmentName = "development" | "test" | "staging" | "production";

export type JPostaApp = "web" | "admin" | "api";

export type DomainStatus = "pending" | "verifying" | "active" | "suspended";

export type MailboxStatus = "active" | "disabled" | "locked";

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}
