"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <p className="text-destructive mb-2">Invalid reset link</p>
        <Link href="/forgot-password" className="text-accent hover:underline text-sm">
          Request a new one
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <p className="text-foreground mb-2">Password reset successful</p>
        <Link
          href="/login"
          className="inline-block mt-2 text-accent hover:underline text-sm"
        >
          Sign in with your new password
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5">New Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="At least 6 characters"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          Confirm Password
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={6}
          className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="Confirm your password"
        />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
      >
        {loading ? "Resetting..." : "Reset Password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Study Partner</h1>
          <p className="text-muted mt-2">Set a new password</p>
        </div>
        <Suspense>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
