"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import PurchaseDisclaimer from "@/components/PurchaseDisclaimer";

const STORAGE_KEY = "elv8_purchase_disclaimer_ack";

export default function ProductDisclaimerPopup() {
  const [open, setOpen] = useState(false);

  // Decide whether to open after mount. The Dialog renders nothing on the
  // server while open=false, so no hydration guard is needed -- we only
  // need to read sessionStorage once on the client. This is a legitimate
  // external-system sync (sessionStorage), so we suppress the lint rule
  // here rather than reach for useSyncExternalStore.
  useEffect(() => {
    const ack = sessionStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!ack) setOpen(true);
  }, []);

  function handleAck() {
    sessionStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/*
        Override the default DialogContent grid + p-4 layout so the body
        can scroll internally while the header and footer stay pinned.
        90dvh (not vh) accounts for iOS Safari's collapsing address bar
        so the modal never gets clipped by browser chrome on mobile.
      */}
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 overflow-hidden sm:max-w-lg sm:max-h-[85vh]">
        <DialogHeader className="shrink-0 border-b border-[#1E2A3F] px-5 py-4 sm:px-6">
          <DialogTitle className="text-lg font-semibold text-[#F5F7FB]">
            Before You Continue
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          <PurchaseDisclaimer className="border-0 bg-transparent p-0 sm:p-0" />
        </div>

        <DialogFooter className="m-0 shrink-0 rounded-b-xl border-t bg-[#121A2B] p-4 sm:px-6">
          <Button
            onClick={handleAck}
            size="lg"
            className="h-12 w-full bg-[#2563EB] text-base font-semibold text-white hover:bg-[#15608c]"
          >
            I Understand &amp; Agree
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
