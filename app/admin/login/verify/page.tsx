"use client";

// ---------------------------------------------------------------------------
// /admin/login/verify -- second-factor TOTP entry
// ---------------------------------------------------------------------------
//
// Reached after username+password succeed at /admin/login. The user pulls
// the 6-digit code from their authenticator app (Google Authenticator, 1Password,
// Authy, etc.) and submits. On success we redirect to /admin.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Verification failed.");
        return;
      }

      // Hard navigation: a freshly issued auth cookie isn't visible to the
      // RSC cache that router.push() consults, so the client-side push
      // sometimes lands without rendering the post-auth /admin tree.
      window.location.assign("/admin");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    // Drop the half-finished session so the user can start over from the
    // username/password screen without a stale cookie.
    await fetch("/api/auth/login/verify", { method: "DELETE" });
    router.push("/admin/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F1626] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-[#F5F7FB]">
            <span className="text-[#2563EB]">ELV8</span> Admin
          </h1>
          <p className="mt-1 text-sm text-[#8A96AC]">
            Two-factor verification
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-6 shadow-sm"
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="code">6-digit code</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                required
                autoFocus
                className="mt-1 text-center text-lg tracking-widest"
                placeholder="000000"
              />
              <p className="mt-1 text-xs text-[#8A96AC]">
                Open your authenticator app and enter the current code.
              </p>
            </div>

            {error && (
              <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-[#2563EB] text-white hover:bg-[#15608c]"
            >
              {loading ? "Verifying..." : "Verify"}
            </Button>

            <button
              type="button"
              onClick={handleCancel}
              className="block w-full text-center text-xs text-[#8A96AC] hover:text-[#D4DBEC]"
            >
              Cancel and sign in again
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
