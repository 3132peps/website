"use client";

// ---------------------------------------------------------------------------
// /admin/login/enroll -- first-time TOTP setup for new admins
// ---------------------------------------------------------------------------
//
// Reached after username + password succeed at /admin/login when the admin
// is not yet enrolled in TOTP. The page fetches a fresh setup secret from
// /api/auth/login/enroll and walks the admin through adding it to their
// authenticator app, then verifying a code to confirm.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EnrollPayload {
  secretBase32: string;
  otpauthUri: string;
  issuer: string;
  account: string;
}

export default function AdminEnrollPage() {
  const router = useRouter();
  const [data, setData] = useState<EnrollPayload | null>(null);
  const [loadError, setLoadError] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<"secret" | "uri" | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/login/enroll", { method: "GET" });
        if (!active) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setLoadError(
            body.error || "Could not load enrolment details. Sign in again.",
          );
          return;
        }
        const json = (await res.json()) as EnrollPayload;
        setData(json);
      } catch {
        if (active) setLoadError("Could not load enrolment details.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Verification failed.");
        return;
      }
      // Hard navigation: a freshly issued auth cookie isn't visible to the
      // RSC cache that router.push() consults, so the client-side push
      // sometimes "succeeds" without rendering the new /admin tree.
      // window.location.assign forces a full reload that picks up the cookie.
      window.location.assign("/admin");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    await fetch("/api/auth/login/enroll", { method: "DELETE" });
    router.push("/admin/login");
  }

  async function copy(value: string, kind: "secret" | "uri") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard blocked -- the admin can still select-and-copy manually.
    }
  }

  // Cheap inline QR using a data URL for the otpauth URI rendered as a
  // single-pixel SVG with a foreignObject. Browsers don't render barcodes
  // natively; rather than adding a dep we display the URI as text and
  // also offer a click-through to a system-installed QR reader (the
  // otpauth:// scheme is handled by most authenticator apps on iOS/Android
  // when opened on the same device). Desktop users use the manual key.

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F1626] px-4">
        <div className="w-full max-w-md rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-6 shadow-sm">
          <h1 className="mb-2 text-lg font-semibold text-[#F5F7FB]">
            Enrolment unavailable
          </h1>
          <p className="text-sm text-[#B0BBD1]">{loadError}</p>
          <Button
            type="button"
            onClick={() => router.push("/admin/login")}
            className="mt-4 w-full bg-[#2563EB] text-white hover:bg-[#15608c]"
          >
            Back to sign-in
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F1626] px-4">
        <p className="text-sm text-[#8A96AC]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F1626] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-[#F5F7FB]">
            <span className="text-[#2563EB]">ELV8</span> Admin
          </h1>
          <p className="mt-1 text-sm text-[#8A96AC]">Set up two-factor auth</p>
        </div>

        <div className="space-y-5 rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-6 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-[#F5F7FB]">
              1. Open your authenticator app
            </h2>
            <p className="mt-1 text-xs text-[#B0BBD1]">
              Google Authenticator, 1Password, Authy, Bitwarden, or any TOTP
              app.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-[#F5F7FB]">
              2. Add a new account using this setup key
            </h2>
            <p className="mt-1 text-xs text-[#B0BBD1]">
              Choose &ldquo;Enter a setup key&rdquo; (or &ldquo;Manual
              entry&rdquo;) in the app. Type is{" "}
              <span className="font-medium">Time-based</span>.
            </p>
            <div className="mt-3 space-y-2 rounded-md bg-[#0F1626] p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#8A96AC]">Account</span>
                <span className="font-mono text-[#F5F7FB]">
                  {data.issuer}: {data.account}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[#8A96AC]">Setup key</span>
                <button
                  type="button"
                  onClick={() => copy(data.secretBase32, "secret")}
                  className="break-all text-right font-mono text-[#F5F7FB] hover:text-[#2563EB]"
                  title="Click to copy"
                >
                  {data.secretBase32}
                </button>
              </div>
              {copied === "secret" && (
                <p className="text-right text-[11px] text-[#2563EB]">
                  Copied
                </p>
              )}
            </div>
            <details className="mt-3 text-xs text-[#B0BBD1]">
              <summary className="cursor-pointer hover:text-[#2563EB]">
                Or use the otpauth:// URI (paste into a QR generator)
              </summary>
              <div className="mt-2 break-all rounded-md bg-[#0F1626] p-3 font-mono text-[11px] text-[#D4DBEC]">
                <button
                  type="button"
                  onClick={() => copy(data.otpauthUri, "uri")}
                  className="text-left hover:text-[#2563EB]"
                  title="Click to copy"
                >
                  {data.otpauthUri}
                </button>
                {copied === "uri" && (
                  <p className="mt-1 text-[11px] text-[#2563EB]">Copied</p>
                )}
              </div>
            </details>
          </div>

          <form onSubmit={handleSubmit} className="border-t border-[#1E2A3F] pt-5">
            <h2 className="text-sm font-semibold text-[#F5F7FB]">
              3. Confirm by entering the 6-digit code
            </h2>
            <div className="mt-3">
              <Label htmlFor="code">Code from your authenticator app</Label>
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
                Once confirmed, this device will be required to sign in from
                now on.
              </p>
            </div>

            {error && (
              <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-600">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting || code.length !== 6}
              className="mt-4 w-full bg-[#2563EB] text-white hover:bg-[#15608c]"
            >
              {submitting ? "Confirming…" : "Confirm and finish setup"}
            </Button>

            <button
              type="button"
              onClick={handleCancel}
              className="mt-3 block w-full text-center text-xs text-[#8A96AC] hover:text-[#D4DBEC]"
            >
              Cancel and sign in again
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
