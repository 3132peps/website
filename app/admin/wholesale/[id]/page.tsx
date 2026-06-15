"use client";

// ---------------------------------------------------------------------------
// /admin/wholesale/[id] -- single wholesale enquiry detail
// ---------------------------------------------------------------------------
//
// Shows every field from the submission, the compliance attestations the
// submitter ticked, and lets the admin progress the status (new ->
// contacted -> qualified, or reject) and add free-form notes.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  WHOLESALE_STATUS_LABELS,
  BUSINESS_TYPE_LABELS,
  DISPATCH_FREQUENCY_LABELS,
  MONTHLY_VOLUME_LABELS,
  type StoredWholesaleEnquiry,
  type WholesaleStatus,
} from "@/lib/wholesale";

const STATUS_COLOURS: Record<WholesaleStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  qualified: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_OPTIONS: WholesaleStatus[] = [
  "new",
  "contacted",
  "qualified",
  "rejected",
];

export default function AdminWholesaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [enquiry, setEnquiry] = useState<StoredWholesaleEnquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingStatus, setSavingStatus] = useState<WholesaleStatus | null>(
    null,
  );
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    fetch(`/api/admin/wholesale/${id}`)
      .then((res) => {
        if (res.status === 401) {
          router.push("/admin/login");
          throw new Error("Unauthorized");
        }
        if (!res.ok) throw new Error("Enquiry not found.");
        return res.json();
      })
      .then((data: StoredWholesaleEnquiry) => {
        setEnquiry(data);
        setNotes(data.adminNotes ?? "");
      })
      .catch((err) => {
        if (err.message !== "Unauthorized") setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  async function patchEnquiry(patch: {
    status?: WholesaleStatus;
    adminNotes?: string;
  }) {
    const res = await fetch(`/api/admin/wholesale/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-elv8-admin": "1",
      },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error ?? "Update failed");
    }
    return data as StoredWholesaleEnquiry;
  }

  async function handleStatusChange(next: WholesaleStatus) {
    if (!enquiry || enquiry.status === next) return;
    setSavingStatus(next);
    setStatusMessage("");
    setError("");
    try {
      const updated = await patchEnquiry({ status: next });
      setEnquiry(updated);
      setStatusMessage(
        `Marked as ${WHOLESALE_STATUS_LABELS[next].toLowerCase()}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingStatus(null);
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    setError("");
    setStatusMessage("");
    try {
      const updated = await patchEnquiry({ adminNotes: notes });
      setEnquiry(updated);
      setStatusMessage("Notes saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingNotes(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F1626]">
        <p className="text-[#8A96AC]">Loading enquiry...</p>
      </div>
    );
  }
  if (error && !enquiry) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0F1626]">
        <p className="text-red-600">{error}</p>
        <Link
          href="/admin/wholesale"
          className="text-sm text-[#2563EB] hover:underline"
        >
          Back to enquiries
        </Link>
      </div>
    );
  }
  if (!enquiry) return null;

  return (
    <div className="min-h-screen bg-[#0F1626]">
      <header className="border-b border-[#1E2A3F] bg-[#121A2B]">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/admin/wholesale"
            className="text-sm text-[#8A96AC] hover:text-[#2563EB]"
          >
            &larr; All enquiries
          </Link>
          <h1 className="text-lg font-bold text-[#F5F7FB]">
            Enquiry{" "}
            <span className="font-mono text-[#2563EB]">#{enquiry.id}</span>
          </h1>
          <Badge className={`ml-auto ${STATUS_COLOURS[enquiry.status]}`}>
            {WHOLESALE_STATUS_LABELS[enquiry.status]}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* Status controls */}
        <section className="mb-6 rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8A96AC]">
            Status
          </h2>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => (
              <Button
                key={s}
                variant={enquiry.status === s ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusChange(s)}
                disabled={savingStatus !== null || enquiry.status === s}
                className={
                  enquiry.status === s
                    ? "bg-[#2563EB] text-white"
                    : "border-[#1E2A3F]"
                }
              >
                {savingStatus === s
                  ? "Saving..."
                  : `Mark ${WHOLESALE_STATUS_LABELS[s].toLowerCase()}`}
              </Button>
            ))}
          </div>
          {statusMessage && (
            <p className="mt-3 text-sm font-medium text-emerald-600">
              {statusMessage}
            </p>
          )}
          {error && (
            <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
          )}
        </section>

        {/* Body */}
        <div className="grid gap-6 lg:grid-cols-2">
          <DetailCard title="Submitter">
            <Field label="Name" value={enquiry.fullName} />
            <Field label="Role" value={enquiry.role} />
            <Field
              label="Email"
              value={
                <a
                  className="text-[#2563EB] underline"
                  href={`mailto:${enquiry.businessEmail}`}
                >
                  {enquiry.businessEmail}
                </a>
              }
            />
            <Field label="Phone" value={enquiry.phone ?? "N/A"} />
            <Field
              label="Website"
              value={
                enquiry.website ? (
                  <a
                    className="text-[#2563EB] underline"
                    href={enquiry.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {enquiry.website}
                  </a>
                ) : (
                  "N/A"
                )
              }
            />
            <Field
              label="Submitted"
              value={new Date(enquiry.createdAt).toLocaleString("en-GB")}
            />
            <Field label="Submitter IP" value={enquiry.submitterIp ?? "N/A"} />
          </DetailCard>

          <DetailCard title="Business">
            <Field label="Business name" value={enquiry.businessName} />
            <Field
              label="Type"
              value={
                BUSINESS_TYPE_LABELS[enquiry.businessType] ??
                enquiry.businessType
              }
            />
            <Field label="Country" value={enquiry.country} />
            <Field label="Years trading" value={enquiry.yearsTrading} />
            <Field
              label="Reg / Companies House"
              value={enquiry.registrationNumber ?? "N/A"}
            />
            <Field label="VAT number" value={enquiry.vatNumber ?? "N/A"} />
          </DetailCard>

          <DetailCard title="Interest">
            <Field
              label="Products of interest"
              value={
                enquiry.productsOfInterest.length === 0 ? (
                  "(none specified)"
                ) : (
                  <ul className="list-disc pl-4">
                    {enquiry.productsOfInterest.map((slug) => (
                      <li key={slug}>
                        <Link
                          href={`/products/${slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#2563EB] underline"
                        >
                          {slug}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              }
            />
            <Field
              label="Other notes (products)"
              value={enquiry.productsOfInterestOther ?? "N/A"}
            />
            <Field
              label="Estimated monthly volume"
              value={
                MONTHLY_VOLUME_LABELS[enquiry.monthlyVolume] ??
                enquiry.monthlyVolume
              }
            />
            <Field
              label="Dispatch frequency"
              value={
                DISPATCH_FREQUENCY_LABELS[enquiry.dispatchFrequency] ??
                enquiry.dispatchFrequency
              }
            />
            <Field
              label="White-label / private-label"
              value={enquiry.whiteLabelInterest ? "Yes" : "No"}
            />
            <Field
              label="Anything else"
              value={
                enquiry.additionalNotes ? (
                  <span className="whitespace-pre-wrap">
                    {enquiry.additionalNotes}
                  </span>
                ) : (
                  "N/A"
                )
              }
            />
          </DetailCard>

          <DetailCard title="Compliance attestation">
            <Attestation
              ticked={enquiry.attestationResearchOnly}
              text="Confirmed: products will be used or onward-supplied for research use only and not for human consumption."
            />
            <Attestation
              ticked={enquiry.attestationRegulatory}
              text="Confirmed: business operates within applicable regulatory frameworks for its jurisdiction."
            />
            <Attestation
              ticked={enquiry.attestationAuthority}
              text="Confirmed: submitter is authorised to make this enquiry on behalf of the business."
            />
          </DetailCard>
        </div>

        {/* Admin notes */}
        <section className="mt-6 rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8A96AC]">
            Admin notes
          </h2>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Internal triage notes -- not visible to the submitter."
          />
          <div className="mt-3 flex justify-end">
            <Button
              onClick={handleSaveNotes}
              disabled={savingNotes || notes === (enquiry.adminNotes ?? "")}
              className="bg-[#2563EB] text-white hover:bg-[#15608c]"
              size="sm"
            >
              {savingNotes ? "Saving..." : "Save notes"}
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#8A96AC]">
        {title}
      </h2>
      <dl className="space-y-3 text-sm">{children}</dl>
    </section>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-[#8A96AC]">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-[#F5F7FB]">{value}</dd>
    </div>
  );
}

function Attestation({ ticked, text }: { ticked: boolean; text: string }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border p-3 ${
        ticked
          ? "border-emerald-200 bg-emerald-50"
          : "border-red-200 bg-red-50"
      }`}
    >
      <span
        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded ${
          ticked
            ? "bg-emerald-600 text-white"
            : "bg-red-600 text-white"
        }`}
      >
        {ticked ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </span>
      <p className="text-xs leading-snug text-[#D4DBEC]">{text}</p>
    </div>
  );
}
