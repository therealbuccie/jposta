"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, MailPlus } from "lucide-react";

import {
  GlassBadge,
  GlassButton,
  GlassCard,
  GlassDivider,
  GlassInput,
  GradientBackground,
} from "@jposta/ui";

import { jpostaApi } from "@/lib/api-client";
import { formString } from "@/lib/form";
import { saveSession } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function submit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      const email = formString(formData, "email");
      const password = formString(formData, "password");
      const session =
        mode === "register"
          ? await jpostaApi.register({
              name: formString(formData, "name"),
              email,
              password,
            })
          : await jpostaApi.login({ email, password });

      saveSession(session);
      router.replace("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

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
              {mode === "register" ? "Create your account" : "Login to your workspace"}
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
          {mode === "register" ? <GlassInput name="name" placeholder="Full name" required /> : null}
          <GlassInput name="email" placeholder="Email" required type="email" />
          <GlassInput name="password" placeholder="Password" required type="password" />
          {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          <GlassButton className="mt-2" disabled={loading} type="submit" variant="primary">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            {loading ? "Please wait..." : mode === "register" ? "Register" : "Login"}
          </GlassButton>
        </form>

        <GlassDivider className="my-5" />
        <button
          className="text-sm font-medium text-sky-700 transition hover:text-sky-900"
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
        </button>
      </GlassCard>
    </GradientBackground>
  );
}
