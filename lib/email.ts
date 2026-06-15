// ---------------------------------------------------------------------------
// 31-32 Peptides -- email service (Resend)
// ---------------------------------------------------------------------------

import { Resend } from "resend";
import type {
  OrderItem,
  OrderFormData,
  OrderClientMeta,
  ContactFormData,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not set.");
  }
  return new Resend(apiKey);
}

function getAdminEmail(): string {
  const email = process.env.ADMIN_EMAIL;
  if (!email) {
    throw new Error("ADMIN_EMAIL environment variable is not set.");
  }
  return email;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderData {
  items: OrderItem[];
  formData: OrderFormData;
  orderRef: string;
  totalPrice: number;
  discountCode?: string;
  discountAmount?: number;
  // Request metadata captured at order time. Only set on the admin email so
  // operators can spot suspicious origins; the customer copy never gets it.
  clientMeta?: OrderClientMeta;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Order: admin notification
// ---------------------------------------------------------------------------

export async function sendOrderEmail(
  orderData: OrderData,
): Promise<EmailResult> {
  try {
    const resend = getResend();
    const adminEmail = getAdminEmail();

    const itemRows = orderData.items
      .map(
        (item) =>
          `- ${item.productName} (${item.weight}) x${item.quantity} -- £${(item.price * item.quantity).toFixed(2)}`,
      )
      .join("\n");

    const discountLine =
      orderData.discountCode && orderData.discountAmount
        ? `\nDiscount (${orderData.discountCode}): -£${orderData.discountAmount.toFixed(2)}`
        : "";

    // Surface fraud signals so the admin can triage suspicious orders from
    // the inbox without having to open the dashboard. Geo / UA come from
    // Vercel edge headers; missing fields render as "N/A".
    const meta = orderData.clientMeta ?? {};
    const geoParts = [meta.city, meta.region, meta.country].filter(Boolean);
    const geoLine = geoParts.length > 0 ? geoParts.join(", ") : "N/A";
    const fraudBlock = `

Order Origin (fraud signals)
----------------------------
IP:         ${meta.ip ?? "N/A"}
Location:   ${geoLine}
User-Agent: ${meta.userAgent ?? "N/A"}`;

    const { data, error } = await resend.emails.send({
      from: "31-32 Peptides <info@31-32peptides.com>",
      to: adminEmail,
      subject: `New Order: ${orderData.orderRef}`,
      text: `
New order received.

Order Reference: ${orderData.orderRef}
Date: ${new Date().toISOString()}

Customer
--------
Name:    ${orderData.formData.fullName}
Email:   ${orderData.formData.email}
Phone:   ${orderData.formData.phone ?? "N/A"}

Delivery Address
----------------
${orderData.formData.addressLine1}
${orderData.formData.addressLine2 ? orderData.formData.addressLine2 + "\n" : ""}${orderData.formData.city}
${orderData.formData.county ? orderData.formData.county + "\n" : ""}${orderData.formData.postcode}

Items
-----
${itemRows}
${discountLine}
Total: £${orderData.totalPrice.toFixed(2)}

Notes: ${orderData.formData.orderNotes ?? "None"}

RUO Confirmed: ${orderData.formData.ruoConfirmed ? "Yes" : "No"}
Terms Accepted: ${orderData.formData.termsAccepted ? "Yes" : "No"}
${fraudBlock}
      `.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ---------------------------------------------------------------------------
// Order: customer confirmation
// ---------------------------------------------------------------------------

export async function sendOrderConfirmation(
  orderData: OrderData,
): Promise<EmailResult> {
  try {
    const resend = getResend();

    const itemRows = orderData.items
      .map(
        (item) =>
          `- ${item.productName} (${item.weight}) x${item.quantity} -- £${(item.price * item.quantity).toFixed(2)}`,
      )
      .join("\n");

    const discountLine =
      orderData.discountCode && orderData.discountAmount
        ? `\nDiscount (${orderData.discountCode}): -£${orderData.discountAmount.toFixed(2)}`
        : "";

    const { data, error } = await resend.emails.send({
      from: "31-32 Peptides <info@31-32peptides.com>",
      to: orderData.formData.email,
      subject: `Order Confirmation - ${orderData.orderRef}`,
      text: `
Thank you for your order with 31-32 Peptides.

Order Reference: ${orderData.orderRef}

Items
-----
${itemRows}
${discountLine}
Total: £${orderData.totalPrice.toFixed(2)}

Delivery Address
----------------
${orderData.formData.addressLine1}
${orderData.formData.addressLine2 ? orderData.formData.addressLine2 + "\n" : ""}${orderData.formData.city}
${orderData.formData.county ? orderData.formData.county + "\n" : ""}${orderData.formData.postcode}

Our team will review your order and get in touch with you directly to confirm and arrange everything.

All products are sold strictly for research use only (RUO). Not for human consumption.

If you have any questions, reply to this email or visit our website.

-- 31-32 Peptides
      `.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ---------------------------------------------------------------------------
// Order: invoice email to customer (with PDF attachment)
// ---------------------------------------------------------------------------

export interface InvoiceEmailData {
  orderRef: string;
  invoiceNumber: string;
  customerEmail: string;
  customerName: string;
  totalPrice: number;
  pdf: Uint8Array;
}

export async function sendInvoiceEmail(
  data: InvoiceEmailData,
): Promise<EmailResult> {
  try {
    const resend = getResend();

    const pdfBuffer = Buffer.from(data.pdf);

    const { data: result, error } = await resend.emails.send({
      from: "31-32 Peptides <info@31-32peptides.com>",
      to: data.customerEmail,
      subject: `Invoice ${data.invoiceNumber} for Order ${data.orderRef}`,
      text: `
Hi ${data.customerName},

Thank you for your order with 31-32 Peptides.

Please find attached your invoice (${data.invoiceNumber}) for order ${data.orderRef}.

Amount Due: GBP ${data.totalPrice.toFixed(2)}

Payment Details -- UK Bank Transfer
-----------------------------------
Account Name:      [PENDING - 31-32 account name]
Sort Code:         00-00-00
Account Number:    00000000
Payment Reference: ${data.orderRef}

IMPORTANT: Please quote "${data.orderRef}" as your payment reference on your bank transfer so we can match the payment to your order and dispatch it without delay.

Once we have received your payment we will pack and dispatch your order. You will receive a dispatch confirmation email at that point.

All products are sold strictly for research use only (RUO). Not for human consumption.

If you have any questions, reply to this email or contact us at info@31-32peptides.com.

-- 31-32 Peptides
      `.trim(),
      attachments: [
        {
          filename: `${data.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: result?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ---------------------------------------------------------------------------
// Order: dispatch notification to customer
// ---------------------------------------------------------------------------

export interface DispatchData {
  orderRef: string;
  customerEmail: string;
  customerName: string;
  items: OrderItem[];
}

export async function sendDispatchEmail(
  data: DispatchData,
): Promise<EmailResult> {
  try {
    const resend = getResend();

    const itemList = data.items
      .map((item) => `- ${item.productName} (${item.weight}) x${item.quantity}`)
      .join("\n");

    const { data: result, error } = await resend.emails.send({
      from: "31-32 Peptides <info@31-32peptides.com>",
      to: data.customerEmail,
      subject: `Your Order Has Been Dispatched - ${data.orderRef}`,
      text: `
Hi ${data.customerName},

Great news! Your order ${data.orderRef} has been dispatched and is on its way to you.

Items
-----
${itemList}

Shipping: UK Tracked Delivery

You should receive your order within 1-3 working days. If you have any questions about your delivery, please don't hesitate to get in touch.

All products are sold strictly for research use only (RUO). Not for human consumption.

Thank you for your order.

-- 31-32 Peptides
      `.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: result?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ---------------------------------------------------------------------------
// Wholesale enquiry: admin notification + submitter auto-reply
// ---------------------------------------------------------------------------
//
// Admin email is the primary triage channel and also acts as a recoverable
// fallback if the DB write fails -- the route handler invokes this function
// even when the DB step throws, so the lead is never lost.

import type {
  StoredWholesaleEnquiry,
  WholesaleEnquiryInput,
} from "@/lib/wholesale";
import {
  BUSINESS_TYPE_LABELS,
  DISPATCH_FREQUENCY_LABELS,
  MONTHLY_VOLUME_LABELS,
} from "@/lib/wholesale";

interface WholesaleEmailPayload extends WholesaleEnquiryInput {
  // Optional persistence metadata -- when present, the admin email tags
  // the lead with its DB id. When the DB write failed, we pass `null` and
  // the email body says "DB write failed; see attached payload" so the
  // admin treats it as a recoverable submission.
  storedId: number | null;
  submitterIp?: string;
  // Receipt time. Defaulted to now() by the caller.
  submittedAt: string;
}

function formatYesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

function indent(text: string, prefix = "    "): string {
  return text
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
}

function buildAdminWholesaleBody(payload: WholesaleEmailPayload): string {
  const productList =
    payload.productsOfInterest.length > 0
      ? payload.productsOfInterest.join(", ")
      : "(none specified)";

  const dbStatus =
    payload.storedId !== null
      ? `Stored as enquiry #${payload.storedId} (admin: /admin/wholesale/${payload.storedId})`
      : "WARNING: DB write failed -- this email is the only record. Re-enter manually if needed.";

  return `
New wholesale enquiry received.

${dbStatus}
Submitted: ${payload.submittedAt}
Submitter IP: ${payload.submitterIp ?? "(unknown)"}

About them
----------
Name:        ${payload.fullName}
Business:    ${payload.businessName}
Role:        ${payload.role}
Email:       ${payload.businessEmail}
Phone:       ${payload.phone ?? "N/A"}
Website:     ${payload.website ?? "N/A"}
Country:     ${payload.country}

Their business
--------------
Type:        ${BUSINESS_TYPE_LABELS[payload.businessType] ?? payload.businessType}
Years:       ${payload.yearsTrading}
Reg number:  ${payload.registrationNumber ?? "N/A"}
VAT number:  ${payload.vatNumber ?? "N/A"}

Their interest
--------------
Products:    ${productList}
Other:       ${payload.productsOfInterestOther ?? "N/A"}
Monthly vol: ${MONTHLY_VOLUME_LABELS[payload.monthlyVolume] ?? payload.monthlyVolume}
Dispatch:    ${DISPATCH_FREQUENCY_LABELS[payload.dispatchFrequency] ?? payload.dispatchFrequency}
White-label: ${formatYesNo(payload.whiteLabelInterest)}

Notes
-----
${indent(payload.additionalNotes?.trim() || "(none)")}

Compliance attestation
----------------------
Research-only:        ${formatYesNo(payload.attestationResearchOnly)}
Regulatory framework: ${formatYesNo(payload.attestationRegulatory)}
Authorised on behalf: ${formatYesNo(payload.attestationAuthority)}
`.trim();
}

function buildSubmitterWholesaleBody(payload: WholesaleEmailPayload): string {
  return `
Hi ${payload.fullName},

Thank you for your wholesale enquiry with 31-32 Peptides. We've received the
following details and will be in touch within 2 business days:

- Business: ${payload.businessName} (${BUSINESS_TYPE_LABELS[payload.businessType] ?? payload.businessType})
- Country: ${payload.country}
- Estimated monthly volume: ${MONTHLY_VOLUME_LABELS[payload.monthlyVolume] ?? payload.monthlyVolume}
- Dispatch frequency: ${DISPATCH_FREQUENCY_LABELS[payload.dispatchFrequency] ?? payload.dispatchFrequency}

If anything changes in the meantime, simply reply to this email and your
note will reach us.

All products supplied by 31-32 Peptides are strictly for in-vitro research
use only (RUO). Onward distribution must comply with the regulatory
framework of the jurisdiction in which you trade.

-- 31-32 Peptides
   info@31-32peptides.com
`.trim();
}

/**
 * Sends the admin notification for a wholesale enquiry. Returns the standard
 * EmailResult; failures are surfaced to the caller so they can decide what
 * else to do (the route already persists the enquiry to DB, so the lead is
 * still on file even if the email step blows up).
 */
export async function sendWholesaleAdminEmail(
  payload: WholesaleEmailPayload,
): Promise<EmailResult> {
  try {
    const resend = getResend();
    const adminEmail = getAdminEmail();
    const subjectTag =
      payload.storedId !== null ? `#${payload.storedId}` : "(DB FAILED)";
    const { data, error } = await resend.emails.send({
      from: "31-32 Peptides <info@31-32peptides.com>",
      to: adminEmail,
      replyTo: payload.businessEmail,
      subject: `Wholesale enquiry ${subjectTag}: ${payload.businessName}`,
      text: buildAdminWholesaleBody(payload),
    });
    if (error) return { success: false, error: error.message };
    return { success: true, messageId: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Auto-reply confirming receipt to the submitter. Best-effort -- a failure
 * here doesn't change the user-facing success state because the form
 * already wrote the row + alerted the admin.
 */
export async function sendWholesaleAcknowledgementEmail(
  payload: WholesaleEmailPayload,
): Promise<EmailResult> {
  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: "31-32 Peptides <info@31-32peptides.com>",
      to: payload.businessEmail,
      subject: "Wholesale enquiry received -- 31-32 Peptides",
      text: buildSubmitterWholesaleBody(payload),
    });
    if (error) return { success: false, error: error.message };
    return { success: true, messageId: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// Re-export the StoredWholesaleEnquiry shape's email payload helper so
// admin "re-send" handlers (if added later) can build the same body.
export function buildWholesaleEmailPayload(
  enquiry: StoredWholesaleEnquiry,
): WholesaleEmailPayload {
  return {
    ...enquiry,
    storedId: enquiry.id,
    submittedAt: enquiry.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Contact form submission
// ---------------------------------------------------------------------------

export async function sendContactEmail(
  contactData: ContactFormData,
): Promise<EmailResult> {
  try {
    const resend = getResend();
    const adminEmail = getAdminEmail();

    const { data, error } = await resend.emails.send({
      from: "31-32 Peptides <info@31-32peptides.com>",
      to: adminEmail,
      replyTo: contactData.email,
      subject: `Contact Form: ${contactData.subject}`,
      text: `
New contact form submission.

From:    ${contactData.name}
Email:   ${contactData.email}
Subject: ${contactData.subject}

Message
-------
${contactData.message}
      `.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
