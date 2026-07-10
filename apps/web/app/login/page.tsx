"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LockKeyhole, MailPlus, XCircle } from "lucide-react";

import {
  GlassBadge,
  GlassButton,
  GlassCard,
  GlassDivider,
  GlassInput,
  GradientBackground,
} from "@jposta/ui";

import { jpostaApi, type UsernameAvailability } from "@/lib/api-client";
import { formString } from "@/lib/form";
import { saveSession } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [username, setUsername] = React.useState("");
  const [availability, setAvailability] = React.useState<UsernameAvailability | null>(null);
  const [availabilityError, setAvailabilityError] = React.useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (mode !== "register") return;
    const nextUsername = username.trim().toLowerCase();
    setAvailability(null);
    setAvailabilityError(null);

    if (!nextUsername) return;

    let cancelled = false;
    setCheckingUsername(true);
    void jpostaApi
      .usernameAvailability(nextUsername)
      .then((result) => {
        if (!cancelled) setAvailability(result);
      })
      .catch((reason) => {
        if (!cancelled) {
          setAvailabilityError(reason instanceof Error ? reason.message : "Username unavailable.");
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingUsername(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, username]);

  async function submit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      const recoveryEmail = formString(formData, "recoveryEmail");
      const session =
        mode === "register"
          ? await jpostaApi.register({
              fullName: formString(formData, "fullName"),
              username: formString(formData, "username"),
              password: formString(formData, "password"),
              confirmPassword: formString(formData, "confirmPassword"),
              ...(recoveryEmail ? { recoveryEmail } : {}),
            })
          : await jpostaApi.login({
              identifier: formString(formData, "identifier"),
              password: formString(formData, "password"),
            });

      saveSession(session);
      router.replace("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  const generatedAddress =
    availability?.email || `${username.trim().toLowerCase() || "username"}@jposta.com`;

  return (
    <GradientBackground className="flex min-h-dvh items-center justify-center px-4 py-8">
      <GlassCard className="w-full max-w-md p-5 sm:p-7" intensity="default">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-200/70 bg-white/80 shadow-inner-glass">
            <MailPlus className="h-5 w-5 text-sky-700" aria-hidden="true" />
          </div>
          <div>
            <GlassBadge tone="premium">JPosta</GlassBadge>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">
              {mode === "register" ? "Create your JPosta account" : "Login to your workspace"}
            </h1>
          </div>
        </div>

        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(new FormData(event.currentTarget));
          }}
        >
          {mode === "register" ? (
            <>
              <Field label="Full name">
                <GlassInput name="fullName" placeholder="Onyebuchi Okeke" required />
              </Field>
              <Field label="Choose your JPosta username">
                <GlassInput
                  name="username"
                  placeholder="onyebuchi"
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </Field>
              <div className="rounded-2xl border border-glass-edge/24 bg-white/68 p-3 text-sm shadow-inner-glass">
                <p className="text-xs text-muted-foreground">Your JPosta address</p>
                <p className="mt-1 break-all font-semibold text-foreground">{generatedAddress}</p>
                <UsernameStatus
                  availability={availability}
                  checking={checkingUsername}
                  error={availabilityError}
                  onPickSuggestion={setUsername}
                />
              </div>
              <Field label="Password">
                <GlassInput
                  name="password"
                  placeholder="At least 10 characters"
                  required
                  type="password"
                />
              </Field>
              <Field label="Confirm password">
                <GlassInput
                  name="confirmPassword"
                  placeholder="Confirm password"
                  required
                  type="password"
                />
              </Field>
              <Field label="Recovery email (recommended)">
                <GlassInput name="recoveryEmail" placeholder="you@example.com" type="email" />
              </Field>
            </>
          ) : (
            <>
              <Field label="JPosta username or email">
                <GlassInput
                  name="identifier"
                  placeholder="onyebuchi or onyebuchi@jposta.com"
                  required
                />
              </Field>
              <Field label="Password">
                <GlassInput name="password" placeholder="Password" required type="password" />
              </Field>
            </>
          )}
          {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          <GlassButton className="mt-2" disabled={loading} type="submit" variant="primary">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            {loading
              ? mode === "register"
                ? "Provisioning mailbox..."
                : "Please wait..."
              : mode === "register"
                ? "Create JPosta account"
                : "Login"}
          </GlassButton>
        </form>

        <GlassDivider className="my-5" />
        <button
          className="text-sm font-medium text-sky-700 transition hover:text-sky-900"
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
          }}
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
        </button>
      </GlassCard>
    </GradientBackground>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function UsernameStatus({
  availability,
  checking,
  error,
  onPickSuggestion,
}: {
  availability: UsernameAvailability | null;
  checking: boolean;
  error: string | null;
  onPickSuggestion: (username: string) => void;
}) {
  if (checking) {
    return <p className="mt-2 text-xs text-muted-foreground">Checking username...</p>;
  }

  if (error) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-rose-600">
        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
        {error}
      </p>
    );
  }

  if (!availability) return null;

  if (availability.available) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Username is available.
      </p>
    );
  }

  return (
    <div className="mt-2 grid gap-2 text-xs text-rose-600">
      <p className="flex items-center gap-1.5">
        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
        Username is unavailable.
      </p>
      {availability.suggestions.length ? (
        <div className="flex flex-wrap gap-1.5">
          {availability.suggestions.map((suggestion) => (
            <button
              className="rounded-full border border-sky-100 bg-white/80 px-2 py-1 text-sky-700 shadow-inner-glass"
              key={suggestion}
              type="button"
              onClick={() => onPickSuggestion(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
