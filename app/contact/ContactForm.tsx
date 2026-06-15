"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const subjects = [
  "General Enquiry",
  "Product Question",
  "Order Query",
  "Wholesale/Bulk",
  "Other",
] as const;

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!name || !email || !subject || !message) return;

    setStatus("sending");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });

      if (!res.ok) {
        setStatus("error");
        return;
      }

      setStatus("success");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-lg border border-[#2563EB]/30 bg-[#2563EB]/5 p-6 text-center">
        <h3 className="text-lg font-semibold text-[#F5F7FB]">
          Message Sent
        </h3>
        <p className="mt-2 text-sm text-[#B0BBD1]">
          Thank you for getting in touch. We will respond within 24 hours on
          business days.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => setStatus("idle")}
        >
          Send Another Message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="contact-name">Name</Label>
        <Input
          id="contact-name"
          type="text"
          required
          placeholder="Your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="contact-email">Email</Label>
        <Input
          id="contact-email"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {/* Subject */}
      <div className="space-y-2">
        <Label>Subject</Label>
        <Select value={subject} onValueChange={(v) => setSubject(v ?? "")} required>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a subject" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Message */}
      <div className="space-y-2">
        <Label htmlFor="contact-message">Message</Label>
        <Textarea
          id="contact-message"
          required
          rows={5}
          placeholder="How can we help?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      {/* Error state */}
      {status === "error" && (
        <p className="text-sm text-red-600">
          Something went wrong. Please try again or email us directly at{" "}
          <a
            href="mailto:info@31-32peptides.com"
            className="underline"
          >
            info@31-32peptides.com
          </a>
          .
        </p>
      )}

      {/* Submit */}
      <Button
        type="submit"
        disabled={status === "sending"}
        className="h-10 w-full rounded-lg bg-[#2563EB] text-sm font-semibold text-white hover:bg-[#155d8a]"
      >
        {status === "sending" ? "Sending..." : "Send Message"}
      </Button>
    </form>
  );
}
