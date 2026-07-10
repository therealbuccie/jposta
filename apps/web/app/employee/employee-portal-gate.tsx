"use client";

import * as React from "react";
import { LogOut } from "lucide-react";

import { GlassButton, GlassCard } from "@jposta/ui";

import { EmployeeWorkspaceClient } from "./employee-workspace-client";
import { jpostaApi, type WebmailMe } from "@/lib/api-client";
import { detectHostContext } from "@/lib/hostname";
import { clearWebmailSession, getStoredWebmailSession } from "@/lib/webmail-session";

export function EmployeePortalGate() {
  const [state, setState] = React.useState<
    { kind: "loading" } | { kind: "main" } | { kind: "authenticated"; token: string; me: WebmailMe }
  >({ kind: "loading" });

  React.useEffect(() => {
    const context = detectHostContext(window.location.hostname, window.location.search);

    if (context.kind !== "portal") {
      setState({ kind: "main" });
      return;
    }

    const stored = getStoredWebmailSession();
    if (!stored) {
      window.location.replace("/");
      return;
    }

    let cancelled = false;
    void jpostaApi
      .webmailMe(stored.token)
      .then((me) => {
        if (!cancelled) setState({ kind: "authenticated", token: stored.token, me });
      })
      .catch(() => {
        clearWebmailSession();
        window.location.replace("/");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <div className="p-4">
        <GlassCard className="p-4 text-sm text-muted-foreground">
          Checking mailbox session...
        </GlassCard>
      </div>
    );
  }

  if (state.kind === "main") {
    return <EmployeeWorkspaceClient />;
  }

  const authenticatedState = state;

  async function logout() {
    await jpostaApi.webmailLogout(authenticatedState.token).catch(() => null);
    clearWebmailSession();
    window.location.assign("/");
  }

  return (
    <div className="grid gap-4">
      <GlassCard
        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
        intensity="soft"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {authenticatedState.me.portal.displayName}
          </p>
          <h1 className="mt-1 text-lg font-semibold text-foreground">
            {authenticatedState.me.mailbox.address}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Authenticated employee mailbox for {authenticatedState.me.portal.organizationName}.
            Inbox retrieval remains placeholder-only in this sprint.
          </p>
        </div>
        <GlassButton onClick={logout} variant="ghost">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Logout
        </GlassButton>
      </GlassCard>
      <EmployeeWorkspaceClient />
    </div>
  );
}
