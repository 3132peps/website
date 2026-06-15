// ---------------------------------------------------------------------------
// 31-32 Peptides -- shared TypeScript types
// ---------------------------------------------------------------------------

// ---- Product catalogue ---------------------------------------------------

export interface ProductVariant {
  weight: string;
  price: number;
  sku: string;
  // Pre-sale (strikethrough) price -- if set and greater than `price`, the
  // storefront renders a "% off" badge and shows the original alongside the
  // sale price. The value the customer is actually charged is always `price`,
  // so basket / order maths don't need to know about sales.
  compareAtPrice?: number;
}

// One constituent line of a bundle product. Bundles are rendered with a
// "What's included" section that links to each constituent's product page.
// `weight` is matched against the constituent's variants so the user sees the
// exact size that's part of the bundle. `label` lets the admin override the
// auto-generated "Name -- 10mg" line where a custom phrasing reads better
// (e.g. "Bacteriostatic water for reconstitution").
export interface BundleItem {
  productSlug: string;
  weight: string;
  label?: string;
}

export interface Product {
  slug: string;
  name: string;
  category: string;
  description: string;
  researchContext: string;
  variants: ProductVariant[];
  purity: string;
  coaUrl: string;
  storageInstructions: string;
  molecularWeight: string;
  sequence: string;
  inStock: boolean;
  images: string[];
  tags: string[];
  relatedSlugs: string[];
  format?: "vial" | "pen" | "nasal";
  contactForPrice?: boolean;
  bulkDeal?: string;
  bulkDealQty?: number;
  bulkDealPrice?: number;
  // Storefront visibility. Defaults to true. When false the product is kept
  // in the admin catalogue but hidden from every customer-facing surface
  // (homepage, /products, /products/[slug], the order API). Used to keep
  // products around for manual / admin-created orders without surfacing
  // them to the public.
  storefrontVisible?: boolean;
  // Bundle support. When `isBundle` is true, the storefront renders a
  // "What's included" section listing each item in `bundleItems` with a
  // link to its product page. Bundles otherwise behave like normal products
  // -- they have variants, prices, and SKUs -- so the basket and order flow
  // don't need to know about bundling. Pricing the bundle is the admin's
  // call; the storefront auto-computes "savings vs buying separately" when
  // the constituent variant prices are known.
  isBundle?: boolean;
  bundleItems?: BundleItem[];
}

// ---- Order ---------------------------------------------------------------

export interface OrderItem {
  productSlug: string;
  productName: string;
  variantSku: string;
  weight: string;
  price: number;
  quantity: number;
}

export interface OrderFormData {
  fullName: string;
  email: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  county?: string;
  postcode: string;
  orderNotes?: string;
  ruoConfirmed: boolean;
  termsAccepted: boolean;
}


// ---- FAQ -----------------------------------------------------------------

export interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQCategory {
  category: string;
  items: FAQItem[];
}

// ---- Guides / articles ---------------------------------------------------

export interface Guide {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  author: string;
  readingTime: string;
  coverImage?: string;
}

// ---- Admin: order management ---------------------------------------------

export type OrderStatus =
  | "received"
  | "invoice-sent"
  | "invoice-paid"
  | "packed"
  | "dispatched"
  | "delivered"
  | "cancelled";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Order Received",
  "invoice-sent": "Invoice Sent",
  "invoice-paid": "Invoice Paid",
  packed: "Order Packed",
  dispatched: "Order Dispatched",
  delivered: "Order Delivered",
  cancelled: "Cancelled",
};

// The happy-path progression. "cancelled" is deliberately NOT part of this
// flow -- it's a side state an order can enter from (almost) any active
// step, so the progress bar still displays six sequential stages.
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "received",
  "invoice-sent",
  "invoice-paid",
  "packed",
  "dispatched",
  "delivered",
];

// Orders past this point have physically left the warehouse and can no
// longer be cancelled from the admin UI.
export const CANCELLABLE_STATUSES: OrderStatus[] = [
  "received",
  "invoice-sent",
  "invoice-paid",
  "packed",
];

export interface StatusHistoryEntry {
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

// Request metadata captured at order time and used as fraud signals during
// triage in the admin UI. All fields are optional -- older rows pre-date
// the column, and on local dev some fields (Vercel geo headers) are absent.
export interface OrderClientMeta {
  ip?: string;
  userAgent?: string;
  country?: string; // ISO 3166-1 alpha-2, e.g. "GB"
  region?: string;  // ISO 3166-2 region, e.g. "ENG"
  city?: string;    // best-effort city name from Vercel edge geo
}

export interface StoredOrder {
  ref: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  customer: {
    fullName: string;
    email: string;
    phone?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    county?: string;
    postcode: string;
  };
  items: OrderItem[];
  subtotal: number;
  postage: number;
  total: number;
  orderNotes?: string;
  ruoConfirmed: boolean;
  termsAccepted: boolean;
  statusHistory: StatusHistoryEntry[];
  discountCode?: string;
  discountAmount?: number;
  clientMeta?: OrderClientMeta;
}

// ---- Discount codes ------------------------------------------------------

export type DiscountType = "percent" | "fixed";

export interface DiscountCode {
  code: string;           // e.g. "SAVE10" (stored uppercase)
  type: DiscountType;     // percent = % off subtotal, fixed = £ off subtotal
  value: number;          // percent: 1-100, fixed: positive GBP amount
  minOrderValue?: number; // optional minimum subtotal (GBP) required
  maxUsages?: number;     // optional cap on how many times the code can be used
  perCustomerLimit?: number; // optional cap per customer email (e.g. 1 = one-time use per customer)
  eligibleProducts?: string[]; // optional list of product slugs; when set, code only discounts those items
  excludedProducts?: string[]; // optional list of product slugs to exclude; discount applies to every other item
  timesUsed: number;      // running counter, incremented on successful order
  expiresAt?: string;     // optional ISO date after which the code is invalid
  active: boolean;        // manual active/inactive toggle
  createdAt: string;
  updatedAt: string;
}

export interface DiscountValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
  type?: DiscountType;
  value?: number;
  discountAmount?: number;
  requiresEmail?: boolean; // true when the code has a per-customer limit and the client needs to supply an email
}

// ---- Contact form --------------------------------------------------------

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}
