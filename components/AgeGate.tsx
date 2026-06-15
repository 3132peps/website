"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const COOKIE_NAME = "elv8_age_verified";
const COOKIE_DAYS = 30;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export default function AgeGate() {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!getCookie(COOKIE_NAME)) {
      setShow(true);
    }
  }, []);

  function handleConfirm() {
    setCookie(COOKIE_NAME, "true", COOKIE_DAYS);
    setShow(false);
  }

  function handleDecline() {
    window.location.href = "https://www.google.com";
  }

  if (!mounted || !show) return null;

  return (
    <Dialog open modal>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 p-0 sm:max-w-lg max-h-[90svh] overflow-hidden"
      >
        {/* Header — fixed */}
        <div className="shrink-0 px-5 pt-5 pb-3 text-center">
          <div className="mb-1.5 text-xl font-bold tracking-tight text-[#2563EB] sm:text-2xl">
            ELV<span className="text-[#2563EB]">8</span>
          </div>

          <DialogTitle className="text-base font-semibold sm:text-lg">
            Age Verification &amp; Research-Use Confirmation
          </DialogTitle>

          <div
            className="mx-auto mt-2 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium"
            style={{ backgroundColor: "#E74C3C15", color: "#E74C3C" }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            18+ Only &middot; Research Use Only
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-b px-5 py-3">
          <div className="space-y-2.5 text-left text-[13px] leading-relaxed text-muted-foreground">
            <p>
              All powdered (lyophilized) products and any other subsequent
              items are strictly for scientific research purposes. No dosing
              guidelines are included. We comply with all local regulations
              regarding Research Only sales within the United Kingdom. We are
              not a pharmacy and do not endorse or offer advice for human or
              animal consumption. Please thoroughly review our terms and
              conditions before making a purchase on our website. International
              customers must check their own local laws and regulations before
              purchasing.
            </p>
            <p className="font-semibold text-[#F5F7FB]">
              You must be 18+ and purchasing for scientific research only.
            </p>
            <p>
              By clicking &lsquo;I Agree&rsquo; you confirm you have read and
              accepted these terms set out in this popup disclaimer.
            </p>
          </div>
        </div>

        {/* Footer — fixed (always visible, buttons always pressable) */}
        <div className="shrink-0 flex flex-col gap-2 bg-muted/50 px-5 py-3">
          <Button
            onClick={handleConfirm}
            size="lg"
            className="h-12 w-full bg-[#2563EB] text-base font-semibold text-white hover:bg-[#15608c]"
          >
            I Agree
          </Button>
          <Button
            onClick={handleDecline}
            variant="outline"
            size="lg"
            className="h-12 w-full border-[#E74C3C]/30 text-base font-semibold text-[#E74C3C] hover:bg-[#E74C3C]/5"
          >
            I Do Not Agree
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
