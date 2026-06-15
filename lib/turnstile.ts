// ---------------------------------------------------------------------------
// Cloudflare Turnstile -- server-side token verification
// ---------------------------------------------------------------------------
//
// The wholesale form embeds a Turnstile widget which produces a one-time
// token client-side. The token is POSTed alongside the form payload; this
// helper exchanges it with Cloudflare's siteverify endpoint to confirm the
// submitter passed the challenge.
//
// Behaviour when `TURNSTILE_SECRET` is unset:
//   - In development, we skip verification (so a developer without keys
//     can still test the form locally) and log a one-time warning.
//   - In production, we *fail closed*: a missing secret means the form is
//     misconfigured, and we reject every submit so spam can't slip through
//     while the admin notices the warning.

const VERIFY_ENDPOINT =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

let warnedAboutMissingSecret = false;

export interface TurnstileResult {
  success: boolean;
  /** When success is false, a short human-readable reason. */
  error?: string;
}

/**
 * Verifies a Turnstile token. Returns success=true when the token is valid
 * (or when verification is intentionally skipped in development).
 *
 * @param token   The `cf-turnstile-response` value from the widget.
 * @param ip      Optional client IP -- Cloudflare uses it to weight the
 *                token's risk score, but it's not strictly required.
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  ip?: string,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return {
        success: false,
        error:
          "Spam protection is misconfigured. Please contact the site administrator.",
      };
    }
    if (!warnedAboutMissingSecret) {
      console.warn(
        "[turnstile] TURNSTILE_SECRET is not set -- skipping verification in development.",
      );
      warnedAboutMissingSecret = true;
    }
    return { success: true };
  }

  if (!token || typeof token !== "string") {
    return { success: false, error: "Please complete the spam check." };
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (ip) body.set("remoteip", ip);

    const res = await fetch(VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      // Don't let a hung Cloudflare endpoint stall the form forever.
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return {
        success: false,
        error: `Spam check failed (status ${res.status}). Please try again.`,
      };
    }

    const data = (await res.json()) as {
      success: boolean;
      "error-codes"?: string[];
    };

    if (data.success) return { success: true };

    return {
      success: false,
      error: `Spam check did not pass${data["error-codes"]?.length ? ` (${data["error-codes"].join(", ")})` : ""}.`,
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? `Spam check failed: ${err.message}`
          : "Spam check failed.",
    };
  }
}
