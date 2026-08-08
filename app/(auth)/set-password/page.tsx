"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { GraduationCap, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Where invited volunteers land after clicking their magic-link email
 * (see `/api/auth/callback?next=/set-password`, set by the invite in
 * `/api/volunteers`). Supabase's invite link signs them in but does not set
 * a password, so `signInWithPassword` on the normal /login page wouldn't
 * work for them until they've been through this page once.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    // Requires an active session — the invite link's callback already signed
    // this browser in. If that session is missing/expired, this errors and
    // we send them to /login to start over (e.g. request a fresh invite).
    const { data: userData, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !userData.user) {
      setIsLoading(false);
      toast.error("Your invite link has expired", { description: "Ask an admin to resend your invite." });
      router.push("/login");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setIsLoading(false);
      toast.error("Couldn't set password", { description: error.message });
      return;
    }

    const { data: profile } = await supabase
      .from("volunteers")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    setIsLoading(false);
    toast.success("Password set — you're all set!");
    router.push(profile?.role === "admin" ? "/admin" : "/dashboard");
    router.refresh();
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
            <p className="text-sm text-muted-foreground">Welcome! Set a password to finish setting up your account.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Set your password</CardTitle>
            <CardDescription>You&apos;ll use this to sign in from now on.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" disabled={isLoading} className="mt-1">
                {isLoading && <Loader2 className="animate-spin" />}
                Set password &amp; continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
