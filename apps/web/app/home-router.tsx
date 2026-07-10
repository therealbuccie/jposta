"use client";

import * as React from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";

import { GlassButton, GlassCard, GlassInput } from "@jposta/ui";

import { BusinessWorkspaceClient } from "./business-workspace-client";
import { jpostaApi, type PortalInfo } from "@/lib/api-client";
import { formString } from "@/lib/form";
import { detectHostContext } from "@/lib/hostname";
import { saveWebmailSession } from "@/lib/webmail-session";

export function HomeRouter() {
  const [state, setState] = React.useState<
    | { kind: "loading" }
    | { kind: "main" }
    | { kind: "portal"; portal: PortalInfo }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  React.useEffect(() => {
    const context = detectHostContext(window.location.hostname, window.location.search);

    if (context.kind !== "portal") {
      setState({ kind: "main" });
      return;
    }

    let cancelled = false;
    void jpostaApi
      .getPortal(context.slug)
      .then((portal) => {
        if (!cancelled) setState({ kind: "portal", portal });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error", message: "This mail portal is unavailable." });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <PortalFrame>
        <p className="text-sm text-muted-foreground">Loading secure mail portal...</p>
      </PortalFrame>
    );
  }

  if (state.kind === "portal") {
    return <PortalLogin portal={state.portal} />;
  }

  if (state.kind === "error") {
    return (
      <PortalFrame>
        <p className="text-sm text-rose-600">{state.message}</p>
      </PortalFrame>
    );
  }

  return <BusinessWorkspaceClient />;
}

function PortalLogin({ portal }: { portal: PortalInfo }) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const displayName = portal.portalDisplayName || portal.organizationName;

  async function submit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      const result = await jpostaApi.webmailLogin({
        email: formString(formData, "email"),
        password: formString(formData, "password"),
        portalSlug: portal.slug,
      });
      saveWebmailSession({
        token: result.webmailSessionToken,
        mailbox: result.mailbox,
        portal: result.portal,
      });
      window.location.assign(result.redirectTo);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PortalFrame>
      <GlassCard className="w-full max-w-md p-5 sm:p-7" intensity="default">
        <div className="mb-6 flex items-center gap-3">
          {portal.portalLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="h-11 w-11 rounded-2xl object-cover shadow-inner-glass"
              src={portal.portalLogoUrl}
              alt=""
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-200/70 bg-white/80 shadow-inner-glass">
              <Mail className="h-5 w-5 text-sky-700" aria-hidden="true" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Welcome to {displayName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Secure business email powered by JPosta
            </p>
          </div>
        </div>
        {portal.portalWelcomeMessage ? (
          <p className="mb-4 rounded-2xl border border-glass-edge/24 bg-white/64 p-3 text-sm text-muted-foreground shadow-inner-glass">
            {portal.portalWelcomeMessage}
          </p>
        ) : null}
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(new FormData(event.currentTarget));
          }}
        >
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Email address
            <GlassInput name="email" placeholder="info@golivyn.com" required type="email" />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Password
            <div className="relative">
              <GlassInput
                name="password"
                placeholder="Mailbox password"
                required
                type={showPassword ? "text" : "password"}
              />
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <GlassButton disabled={loading} type="submit" variant="primary">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            {loading ? "Signing in..." : "Sign in"}
          </GlassButton>
        </form>
      </GlassCard>
    </PortalFrame>
  );
}

function PortalFrame({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[70dvh] items-center justify-center px-4 py-8">{children}</div>;
}
