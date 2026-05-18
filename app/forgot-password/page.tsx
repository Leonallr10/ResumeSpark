"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { ArrowLeft, Loader2, Mail, KeyRound } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-1/3 h-[500px] w-[500px] rounded-full bg-emerald-500/8 blur-[120px]" />
        <div className="absolute -right-40 bottom-1/3 h-[400px] w-[400px] rounded-full bg-green-500/6 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <span className="bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-3xl font-bold text-transparent">
              AURABIO
            </span>
          </Link>
          <p className="mt-2 text-sm text-gray-500">Reset your password</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/15 bg-gradient-to-b from-gray-900/80 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
          {sent ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
                <Mail className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="mb-2 text-xl font-bold text-white">Check your email</h2>
              <p className="mb-6 text-sm text-gray-400">
                We&apos;ve sent a password reset link to <span className="text-emerald-400">{email}</span>. It may take a minute to arrive.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 px-6 py-2.5 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Sign In
              </Link>
            </motion.div>
          ) : (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15">
                  <KeyRound className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Forgot password?</h1>
                  <p className="text-sm text-gray-400">No worries, we&apos;ll send you a reset link</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-400">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full rounded-xl border border-emerald-500/20 bg-black/60 py-3 pl-11 pr-4 text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
                  >
                    {error}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-400 py-3 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/30 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Send Reset Link
                </button>
              </form>
            </>
          )}
        </div>

        {!sent && (
          <p className="mt-6 text-center text-sm text-gray-500">
            <Link href="/login" className="inline-flex items-center gap-1 font-medium text-emerald-400 transition-colors hover:text-emerald-300">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
            </Link>
          </p>
        )}
      </motion.div>
    </div>
  );
}
