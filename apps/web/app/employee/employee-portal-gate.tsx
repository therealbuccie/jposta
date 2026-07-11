"use client";

import * as React from "react";

import { GlassCard } from "@jposta/ui";

import { EmployeeWorkspaceClient } from "./employee-workspace-client";
import { jpostaApi } from "@/lib/api-client";
import { detectHostContext } from "@/lib/hostname";
import { clearWebmailSession, getStoredWebmailSession } from "@/lib/webmail-session";

export function EmployeePortalGate() {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const context = detectHostContext(window.location.hostname, window.location.search);
    if (context.kind !== "portal") {
      setReady(true);
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
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        clearWebmailSession();
        window.location.replace("/");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="p-4">
        <GlassCard className="p-4 text-sm text-muted-foreground">Loading your mailbox...</GlassCard>
      </div>
    );
  }

  return <EmployeeWorkspaceClient />;
}
