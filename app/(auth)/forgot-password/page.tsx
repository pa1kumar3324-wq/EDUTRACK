"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { GraduationCap, Loader2, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

/**
 * Self-serve "forgot password" entry point (linked from /login). Sends a
 * Supabase recovery email via `resetPasswordForEmail` — no service-role key
 * or server route needed, this is a normal anon-client call.
 *
 * The redirect target is built from `window.location.origin` rather than
 * `lib/utils/getSiteUrl`: that helper exists to protect *server-generated*
 * emails (invites) from an untrustworthy `request.url`, but this call
 * happens directly in the requester's own browser, so `window.location`
 * really is the origin they're on — there's nothing to spoof.
 *
 * Always shows the same success state regardless of whether the email is
 * registered, so this can't be used to enumerate volunteer accounts.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    const supabase = createClient();

    const redirectTo = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent("/reset-password")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    setIsLoading(false);
    if (error) {
      // Don't leak whether the email exists — show the same generic error
      // for anything except obvious client-side problems (e.g. rate limit).
      toast.error("Something went wrong", { description: error.message });
      return;
    }
    setSubmitted(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold">EduTrack</h1>
            <p className="text-sm text-muted-foreground">Reset your password.</p>
          </div>
        </div>

        <Card>
          {submitted ? (
            <CardContent className="flex flex-col gap-3 py-6 text-center">
              <CardTitle>Check your email</CardTitle>
              <CardDescription>
                If an account exists for <span className="font-medium text-foreground">{email}</span>, we&apos;ve
                sent a link to reset your password.
              </CardDescription>
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Forgot password</CardTitle>
                <CardDescription>We&apos;ll email you a link to set a new one.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@ngo.org"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                  <Button type="submit" disabled={isLoading} className="mt-1">
                    {isLoading && <Loader2 className="animate-spin" />}
                    Send reset link
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>

        <Link
          href="/login"
          className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </motion.div>
    </div>
  );
}
