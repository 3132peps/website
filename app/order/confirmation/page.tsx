"use client";

import { useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASKET_KEY = "elv8_basket";

// ---------------------------------------------------------------------------
// Inner component (needs useSearchParams which requires Suspense boundary)
// ---------------------------------------------------------------------------

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref") ?? "N/A";

  // Clear basket on mount
  useEffect(() => {
    try {
      localStorage.removeItem(BASKET_KEY);
    } catch {
      // silent
    }
  }, []);

  return (
    <main className="min-h-screen bg-[#1A2439]">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-8 text-center shadow-sm sm:p-12">
          {/* Success icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#2563EB]/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-[#2563EB]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          {/* Heading */}
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-[#F5F7FB] sm:text-3xl">
            Thank You for Your Order!
          </h1>

          {/* Reference */}
          <div className="mt-6 rounded-lg bg-[#1A2439] px-6 py-4">
            <p className="text-sm text-[#F5F7FB]/60">Order Reference</p>
            <p className="mt-1 text-xl font-bold tracking-wide text-[#2563EB]">
              {ref}
            </p>
          </div>

          {/* Message */}
          <p className="mt-6 text-[#F5F7FB]/70">
            Our team will review your order and get in touch with you directly
            to confirm and arrange everything.
          </p>

          {/* What happens next */}
          <div className="mt-10 text-left">
            <h2 className="text-lg font-semibold text-[#F5F7FB]">
              What happens next?
            </h2>

            <ol className="mt-4 space-y-4">
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-sm font-bold text-white">
                  1
                </span>
                <div>
                  <p className="font-medium text-[#F5F7FB]">Order Review</p>
                  <p className="text-sm text-[#F5F7FB]/60">
                    Our team verifies stock availability and checks your order
                    details.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-sm font-bold text-white">
                  2
                </span>
                <div>
                  <p className="font-medium text-[#F5F7FB]">
                    Our Team Will Be In Touch
                  </p>
                  <p className="text-sm text-[#F5F7FB]/60">
                    A member of our team will contact you directly to confirm
                    your order and arrange everything offline.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-sm font-bold text-white">
                  3
                </span>
                <div>
                  <p className="font-medium text-[#F5F7FB]">Dispatch</p>
                  <p className="text-sm text-[#F5F7FB]/60">
                    Once your order is confirmed, it is dispatched via Royal
                    Mail Tracked. Our team will keep you updated directly.
                  </p>
                </div>
              </li>
            </ol>
          </div>

          {/* Links */}
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/">
              <Button
                variant="outline"
                className="w-full sm:w-auto border-[#2563EB] text-[#2563EB] hover:bg-[#2563EB]/5"
              >
                Back to Home
              </Button>
            </Link>
            <Link href="/products">
              <Button className="w-full sm:w-auto bg-[#2563EB] hover:bg-[#2563EB]/90 text-white">
                Browse Products
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Page (with Suspense boundary for useSearchParams)
// ---------------------------------------------------------------------------

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#1A2439]">
          <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="animate-pulse space-y-4 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-gray-200" />
              <div className="mx-auto h-8 w-64 rounded bg-gray-200" />
              <div className="mx-auto h-4 w-48 rounded bg-gray-200" />
            </div>
          </div>
        </main>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}
