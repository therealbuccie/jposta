import { Injectable, ServiceUnavailableException } from "@nestjs/common";

const timeoutMs = 8000;

type ProvisionMailboxInput = {
  address: string;
  password: string;
  quotaMb: number;
};

@Injectable()
export class MailProvisioningService {
  async createMailbox(input: ProvisionMailboxInput) {
    await this.request("/mailboxes", {
      method: "POST",
      body: {
        address: input.address,
        password: input.password,
        quotaMb: input.quotaMb,
      },
    });
  }

  async deleteMailbox(address: string) {
    await this.request(`/mailboxes/${encodeURIComponent(address)}`, { method: "DELETE" });
  }

  async updatePassword(address: string, password: string) {
    await this.request(`/mailboxes/${encodeURIComponent(address)}/password`, {
      method: "PATCH",
      body: { password },
    });
  }

  private async request(path: string, init: { body?: Record<string, unknown>; method: string }) {
    const baseUrl = process.env.MAIL_PROVISIONER_URL;
    const token = process.env.MAIL_PROVISIONER_TOKEN;

    if (!baseUrl || !token) {
      throw new ServiceUnavailableException("Mail provisioner is not configured.");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const requestInit: RequestInit = {
        method: init.method,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      };

      if (init.body) {
        requestInit.body = JSON.stringify(init.body);
      }

      const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, requestInit);

      if (!response.ok) {
        throw new ServiceUnavailableException(
          `Mail provisioner request failed with status ${response.status}.`,
        );
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        await response.json();
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      const details = error instanceof Error ? error.message : String(error);
      throw new ServiceUnavailableException(
        `Mail provisioner request failed or timed out. Error: ${details}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
