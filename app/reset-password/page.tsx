"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle, Loader2, KeyRound } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/"), 2000);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f8f8] px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Set New Password</h1>
          <p className="text-center text-sm text-muted-foreground">
            Enter your new password below.
          </p>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-green-700">
              Password updated successfully! Redirecting...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="h-10"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(e); }}
                className="h-10"
                required
              />
            </div>

            {error ? (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            ) : null}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Update Password
            </Button>
          </form>
        )}

        <div className="text-center">
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            onClick={() => router.push("/")}
          >
            Back to app
          </button>
        </div>
      </div>
    </div>
  );
}
