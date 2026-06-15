import { NextResponse } from "next/server";
import { sendContactEmail } from "@/lib/email";
import type { ContactFormData } from "@/lib/types";
import { enforceRateLimit } from "@/lib/rate-limit";
import { stripControlChars } from "@/lib/sanitize";

// Bounds on contact-form input. Picked to be generous enough for any
// legitimate enquiry but tight enough to keep our inbox / DB sane against
// a determined spammer.
const NAME_MAX = 200;
const EMAIL_MAX = 254;
const SUBJECT_MAX = 200;
const MESSAGE_MAX = 5_000;

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // 5 messages per IP per 10 minutes -- enough for normal back-and-forth
  // (someone correcting a typo and resubmitting), tight enough that a
  // scripted spam run hits the wall fast.
  const limited = enforceRateLimit(request, {
    name: "contact",
    windowMs: 10 * 60 * 1000,
    max: 5,
  });
  if (limited) return limited;

  try {
    const body = await request.json();

    const raw = body as Partial<ContactFormData>;
    const name = typeof raw.name === "string" ? stripControlChars(raw.name).trim() : "";
    const email = typeof raw.email === "string" ? raw.email.trim() : "";
    const subject = typeof raw.subject === "string" ? stripControlChars(raw.subject).trim() : "";
    const message = typeof raw.message === "string" ? stripControlChars(raw.message).trim() : "";

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { success: false, error: "All fields are required." },
        { status: 400 },
      );
    }

    if (
      name.length > NAME_MAX ||
      email.length > EMAIL_MAX ||
      subject.length > SUBJECT_MAX ||
      message.length > MESSAGE_MAX
    ) {
      return NextResponse.json(
        { success: false, error: "One or more fields exceed the maximum length." },
        { status: 400 },
      );
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email address." },
        { status: 400 },
      );
    }

    // Attempt to send email -- if it fails, still return success (MVP)
    try {
      await sendContactEmail({ name, email, subject, message });
    } catch {
      // Log but do not block the response
      console.error("Failed to send contact email");
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request." },
      { status: 400 },
    );
  }
}

