"use client";

// ---------------------------------------------------------------------------
// Wholesale enquiry form -- public, posts to /api/wholesale
// ---------------------------------------------------------------------------
//
// Renders a single big controlled form (one screen, scrollable). On submit
// it posts JSON, shows an inline error if the API rejects, and swaps the
// whole form for a success card on a 2xx response. There's deliberately no
// router push -- the spec asks for a success state on the page.

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Country list -- enough to cover most realistic submissions while keeping
// the dropdown short. UK is default per spec. "Other" lets the submitter
// pick any country we forgot, with the freeform field expanding next to it.
const COUNTRIES = [
  "United Kingdom",
  "Ireland",
  "France",
  "Germany",
  "Spain",
  "Italy",
  "Netherlands",
  "Belgium",
  "Luxembourg",
  "Austria",
  "Switzerland",
  "Norway",
  "Sweden",
  "Denmark",
  "Finland",
  "Iceland",
  "Portugal",
  "Czech Republic",
  "Poland",
  "Estonia",
  "Latvia",
  "Lithuania",
  "Hungary",
  "Romania",
  "Greece",
  "Cyprus",
  "Malta",
  "Australia",
  "New Zealand",
  "Canada",
  "United States",
  "Other (specify in notes)",
] as const;

type Country = (typeof COUNTRIES)[number];

const BUSINESS_TYPE_OPTIONS = [
  { value: "research-institution", label: "Research institution" },
  { value: "university", label: "University" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "clinic", label: "Clinic" },
  { value: "aesthetic-provider", label: "Aesthetic provider" },
  { value: "reseller-retailer", label: "Reseller / retailer" },
  { value: "distributor", label: "Distributor" },
  { value: "other", label: "Other" },
] as const;

const YEARS_OPTIONS = [
  { value: "<1", label: "Under 1 year" },
  { value: "1-3", label: "1 – 3 years" },
  { value: "3-5", label: "3 – 5 years" },
  { value: "5+", label: "5+ years" },
] as const;

const VOLUME_OPTIONS = [
  { value: "<50", label: "Under 50 vials / month" },
  { value: "50-200", label: "50 – 200 vials / month" },
  { value: "200-500", label: "200 – 500 vials / month" },
  { value: "500-1000", label: "500 – 1,000 vials / month" },
  { value: "1000+", label: "1,000+ vials / month" },
] as const;

const FREQUENCY_OPTIONS = [
  { value: "one-off", label: "One-off" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "ad-hoc", label: "Ad-hoc" },
] as const;

interface CataloguePick {
  slug: string;
  name: string;
  category: string;
}

interface FormState {
  fullName: string;
  businessName: string;
  role: string;
  businessEmail: string;
  phone: string;
  website: string;
  country: Country;

  businessType: (typeof BUSINESS_TYPE_OPTIONS)[number]["value"] | "";
  yearsTrading: (typeof YEARS_OPTIONS)[number]["value"] | "";
  registrationNumber: string;
  vatNumber: string;

  productsOfInterest: Set<string>;
  productsOfInterestOther: string;
  monthlyVolume: (typeof VOLUME_OPTIONS)[number]["value"] | "";
  dispatchFrequency: (typeof FREQUENCY_OPTIONS)[number]["value"] | "";
  whiteLabelInterest: "yes" | "no" | "";
  additionalNotes: string;

  attestationResearchOnly: boolean;
  attestationRegulatory: boolean;
  attestationAuthority: boolean;
}

const EMPTY_STATE: FormState = {
  fullName: "",
  businessName: "",
  role: "",
  businessEmail: "",
  phone: "",
  website: "",
  country: "United Kingdom",

  businessType: "",
  yearsTrading: "",
  registrationNumber: "",
  vatNumber: "",

  productsOfInterest: new Set<string>(),
  productsOfInterestOther: "",
  monthlyVolume: "",
  dispatchFrequency: "",
  whiteLabelInterest: "",
  additionalNotes: "",

  attestationResearchOnly: false,
  attestationRegulatory: false,
  attestationAuthority: false,
};

// Cloudflare's turnstile.render returns a widget id we never use; we just
// read the token from the hidden input it sets. This minimal global type
// avoids pulling in @types/cloudflare which isn't on the project.
declare global {
  interface Window {
    turnstile?: {
      render: (
        selector: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

interface WholesaleFormProps {
  catalogue: CataloguePick[];
  turnstileSiteKey: string;
}

export default function WholesaleForm({
  catalogue,
  turnstileSiteKey,
}: WholesaleFormProps) {
  const [state, setState] = useState<FormState>(() => ({ ...EMPTY_STATE }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReady, setTurnstileReady] = useState(false);
  const turnstileWidgetRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  // Toggle a product slug in the multi-select. We use a Set internally so
  // we don't churn array references on every click.
  function toggleProduct(slug: string) {
    setState((prev) => {
      const next = new Set(prev.productsOfInterest);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return { ...prev, productsOfInterest: next };
    });
  }

  // Mount the Turnstile widget once the script has loaded AND the container
  // is in the DOM. Re-mounting on a new submission attempt is handled by
  // calling turnstile.reset() in the catch block below.
  useEffect(() => {
    if (!turnstileSiteKey) return;
    if (!turnstileReady) return;
    if (!turnstileWidgetRef.current) return;
    if (turnstileWidgetIdRef.current) return; // already mounted
    if (typeof window === "undefined" || !window.turnstile) return;
    turnstileWidgetIdRef.current = window.turnstile.render(
      turnstileWidgetRef.current,
      {
        sitekey: turnstileSiteKey,
        callback: (token) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () => setTurnstileToken(""),
        theme: "light",
      },
    );
  }, [turnstileSiteKey, turnstileReady]);

  function resetTurnstile() {
    if (typeof window === "undefined" || !window.turnstile) return;
    if (turnstileWidgetIdRef.current) {
      window.turnstile.reset(turnstileWidgetIdRef.current);
    }
    setTurnstileToken("");
  }

  const isUk = useMemo(
    () =>
      /^united kingdom$|^uk$|^great britain$/i.test(state.country.trim()),
    [state.country],
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    // Front-end gate -- the server is the source of truth, but a quick
    // pre-check saves a round-trip and gives the user precise feedback.
    if (!state.fullName.trim()) return setError("Full name is required.");
    if (!state.businessName.trim()) return setError("Business name is required.");
    if (!state.role.trim()) return setError("Role is required.");
    if (
      !state.businessEmail.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.businessEmail)
    ) {
      return setError("A valid business email is required.");
    }
    if (!state.country) return setError("Country is required.");
    if (!state.businessType) return setError("Pick a business type.");
    if (!state.yearsTrading) return setError("Pick a years-trading band.");
    if (isUk && !state.registrationNumber.trim()) {
      return setError(
        "Companies House / business registration number is required for UK businesses.",
      );
    }
    if (!state.monthlyVolume)
      return setError("Pick an estimated monthly volume.");
    if (!state.dispatchFrequency)
      return setError("Pick a dispatch frequency.");
    if (!state.whiteLabelInterest)
      return setError("Tell us whether you require white-label / private-label.");
    if (!state.attestationResearchOnly)
      return setError("Tick the research-only confirmation to continue.");
    if (!state.attestationRegulatory)
      return setError("Tick the regulatory framework confirmation to continue.");
    if (!state.attestationAuthority)
      return setError("Tick the authorised-to-enquire confirmation to continue.");
    if (turnstileSiteKey && !turnstileToken) {
      return setError("Please complete the spam check.");
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/wholesale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: state.fullName.trim(),
          businessName: state.businessName.trim(),
          role: state.role.trim(),
          businessEmail: state.businessEmail.trim(),
          phone: state.phone.trim(),
          website: state.website.trim(),
          country: state.country,
          businessType: state.businessType,
          yearsTrading: state.yearsTrading,
          registrationNumber: state.registrationNumber.trim(),
          vatNumber: state.vatNumber.trim(),
          productsOfInterest: Array.from(state.productsOfInterest),
          productsOfInterestOther: state.productsOfInterestOther.trim(),
          monthlyVolume: state.monthlyVolume,
          dispatchFrequency: state.dispatchFrequency,
          whiteLabelInterest: state.whiteLabelInterest === "yes",
          additionalNotes: state.additionalNotes.trim(),
          attestationResearchOnly: state.attestationResearchOnly,
          attestationRegulatory: state.attestationRegulatory,
          attestationAuthority: state.attestationAuthority,
          turnstileToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error ?? `Submission failed (${res.status}). Please try again.`,
        );
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit.");
      // Turnstile tokens are one-shot. Reset the widget so the user can
      // retry without a manual refresh.
      resetTurnstile();
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------
  // Success state -- swaps the entire form, no redirect
  // ---------------------------------------------------------------------
  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center sm:p-10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[#F5F7FB] sm:text-2xl">
          Enquiry received
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[#D4DBEC] sm:text-base">
          Thanks for reaching out. We&rsquo;ve emailed a confirmation to{" "}
          <strong>{state.businessEmail}</strong>. A member of our team will
          review your enquiry and respond within{" "}
          <strong>2 business days</strong>.
        </p>
        <p className="mx-auto mt-3 max-w-xl text-xs text-[#8A96AC]">
          If you don&rsquo;t see our acknowledgement email, please check your
          spam folder or contact{" "}
          <a
            href="mailto:info@31-32peptides.com"
            className="text-[#2563EB] underline hover:text-[#155d8a]"
          >
            info@31-32peptides.com
          </a>
          .
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Form
  // ---------------------------------------------------------------------
  return (
    <>
      {turnstileSiteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          async
          defer
          onLoad={() => setTurnstileReady(true)}
          onReady={() => setTurnstileReady(true)}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* About you ---------------------------------------------- */}
        <Section title="About you">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required>
              <Input
                value={state.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                required
                autoComplete="name"
              />
            </Field>
            <Field label="Business / institution name" required>
              <Input
                value={state.businessName}
                onChange={(e) => update("businessName", e.target.value)}
                required
                autoComplete="organization"
              />
            </Field>
            <Field label="Role / position" required>
              <Input
                value={state.role}
                onChange={(e) => update("role", e.target.value)}
                required
                autoComplete="organization-title"
                placeholder="e.g. Procurement Manager"
              />
            </Field>
            <Field label="Business email" required>
              <Input
                type="email"
                value={state.businessEmail}
                onChange={(e) => update("businessEmail", e.target.value)}
                required
                autoComplete="email"
              />
            </Field>
            <Field label="Phone">
              <Input
                type="tel"
                value={state.phone}
                onChange={(e) => update("phone", e.target.value)}
                autoComplete="tel"
              />
            </Field>
            <Field label="Website">
              <Input
                type="url"
                value={state.website}
                onChange={(e) => update("website", e.target.value)}
                autoComplete="url"
                placeholder="https://"
              />
            </Field>
            <Field label="Country" required>
              <select
                value={state.country}
                onChange={(e) => update("country", e.target.value as Country)}
                required
                className={selectClass}
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        {/* Your business ----------------------------------------- */}
        <Section title="Your business">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business type" required>
              <select
                value={state.businessType}
                onChange={(e) =>
                  update(
                    "businessType",
                    e.target.value as FormState["businessType"],
                  )
                }
                required
                className={selectClass}
              >
                <option value="">-- select one --</option>
                {BUSINESS_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Years trading" required>
              <select
                value={state.yearsTrading}
                onChange={(e) =>
                  update(
                    "yearsTrading",
                    e.target.value as FormState["yearsTrading"],
                  )
                }
                required
                className={selectClass}
              >
                <option value="">-- select one --</option>
                {YEARS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Companies House / business registration number"
              required={isUk}
              hint={
                isUk
                  ? "Required for UK businesses."
                  : "Optional outside the UK -- include if you have one."
              }
            >
              <Input
                value={state.registrationNumber}
                onChange={(e) => update("registrationNumber", e.target.value)}
                required={isUk}
              />
            </Field>
            <Field label="VAT number">
              <Input
                value={state.vatNumber}
                onChange={(e) => update("vatNumber", e.target.value)}
              />
            </Field>
          </div>
        </Section>

        {/* Your interest ----------------------------------------- */}
        <Section title="Your interest">
          <Field
            label="Products of interest"
            hint="Tick any that apply, or use the 'Other' field below."
          >
            <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-[#1E2A3F] bg-[#121A2B] p-3 sm:grid-cols-2">
              {catalogue.length === 0 ? (
                <p className="text-xs text-[#8A96AC]">
                  Catalogue is loading -- you can still describe what you need
                  in the &ldquo;Other&rdquo; field below.
                </p>
              ) : (
                catalogue.map((p) => (
                  <label
                    key={p.slug}
                    className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-[#0F1626]"
                  >
                    <input
                      type="checkbox"
                      checked={state.productsOfInterest.has(p.slug)}
                      onChange={() => toggleProduct(p.slug)}
                      className="mt-0.5 h-4 w-4 rounded border-[#2B3A54]"
                    />
                    <span className="text-sm text-[#D4DBEC]">
                      <span className="font-medium text-[#F5F7FB]">
                        {p.name}
                      </span>
                      <span className="block text-[11px] text-[#8A96AC]">
                        {p.category}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </Field>
          <Field
            label="Other products / details"
            hint="Use this if your interest isn't captured by the list above."
          >
            <Textarea
              rows={3}
              value={state.productsOfInterestOther}
              onChange={(e) =>
                update("productsOfInterestOther", e.target.value)
              }
              placeholder="e.g. Tirzepatide pens, custom blends, lab supplies..."
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Estimated monthly volume" required>
              <select
                value={state.monthlyVolume}
                onChange={(e) =>
                  update(
                    "monthlyVolume",
                    e.target.value as FormState["monthlyVolume"],
                  )
                }
                required
                className={selectClass}
              >
                <option value="">-- select one --</option>
                {VOLUME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Required dispatch frequency" required>
              <select
                value={state.dispatchFrequency}
                onChange={(e) =>
                  update(
                    "dispatchFrequency",
                    e.target.value as FormState["dispatchFrequency"],
                  )
                }
                required
                className={selectClass}
              >
                <option value="">-- select one --</option>
                {FREQUENCY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field
            label="Do you require white-label / private-label?"
            required
          >
            <div className="flex gap-3">
              {(["yes", "no"] as const).map((v) => (
                <label
                  key={v}
                  className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                    state.whiteLabelInterest === v
                      ? "border-[#2563EB] bg-[#2563EB]/5 text-[#2563EB]"
                      : "border-[#1E2A3F] bg-[#121A2B] text-[#F5F7FB] hover:border-[#2563EB]/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="whiteLabel"
                    value={v}
                    checked={state.whiteLabelInterest === v}
                    onChange={() => update("whiteLabelInterest", v)}
                    className="h-4 w-4"
                  />
                  <span className="capitalize">{v}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Anything else we should know?">
            <Textarea
              rows={4}
              value={state.additionalNotes}
              onChange={(e) => update("additionalNotes", e.target.value)}
              placeholder="Lead times, regulatory documents you need, technical questions..."
            />
          </Field>
        </Section>

        {/* Compliance attestation -------------------------------- */}
        <Section
          title="Compliance attestation"
          hint="All three confirmations are required."
        >
          <Attestation
            checked={state.attestationResearchOnly}
            onChange={(v) => update("attestationResearchOnly", v)}
            text="I confirm products will be used or onward-supplied for research use only and not for human consumption."
          />
          <Attestation
            checked={state.attestationRegulatory}
            onChange={(v) => update("attestationRegulatory", v)}
            text="I confirm my business operates within applicable regulatory frameworks for the jurisdiction in which it trades."
          />
          <Attestation
            checked={state.attestationAuthority}
            onChange={(v) => update("attestationAuthority", v)}
            text="I confirm I am authorised to make this enquiry on behalf of the business named above."
          />
        </Section>

        {/* Turnstile + submit ----------------------------------- */}
        {/* The Turnstile widget only renders when a site key is configured.
            We deliberately don't surface a "not configured" banner to
            visitors -- the form stays clean and the API still validates +
            captures the submission server-side either way. */}
        <div className="space-y-4 border-t border-[#1E2A3F] pt-6">
          {turnstileSiteKey && (
            <div ref={turnstileWidgetRef} aria-label="Spam check" />
          )}
          <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
            <p className="text-xs text-[#8A96AC] sm:flex-1">
              We&rsquo;ll only use these details to respond to your enquiry.
              See our{" "}
              <a
                href="/privacy"
                className="text-[#2563EB] underline hover:text-[#155d8a]"
              >
                privacy policy
              </a>
              .
            </p>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#2563EB] text-white hover:bg-[#15608c]"
              size="lg"
            >
              {submitting ? "Submitting..." : "Submit wholesale enquiry"}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------
// Layout helpers (mirrors patterns used by ProductForm and AdminOrderForm)
// ---------------------------------------------------------------------------

const selectClass =
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#1E2A3F] bg-[#0F1626] p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-[#F5F7FB]">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-[#8A96AC]">{hint}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm font-medium text-[#D4DBEC]">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      {children}
      {hint && <p className="mt-1 text-xs text-[#8A96AC]">{hint}</p>}
    </div>
  );
}

function Attestation({
  checked,
  onChange,
  text,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  text: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#1E2A3F] bg-[#121A2B] p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
        className="mt-0.5 h-4 w-4 rounded border-[#2B3A54]"
      />
      <span className="text-sm text-[#D4DBEC]">{text}</span>
    </label>
  );
}
