// ---------------------------------------------------------------------------
// Temporary per-product dispatch lead-time notices, keyed by product slug.
// ---------------------------------------------------------------------------
//
// Surfaced as a badge on the product card and a notice banner on the product
// detail page. Kept here (rather than in the DB) so a temporary "made to
// order" wait can be toggled in a single place without a schema change --
// mirrors the BEST_SELLER_PREFIXES pattern in ProductCatalogue.
//
// To clear a notice once stock normalises, delete the product's entry below.

export interface LeadTime {
  /** Short label shown as a badge on the product card. */
  badge: string;
  /** Full sentence shown as a notice banner on the product detail page. */
  notice: string;
}

export const LEAD_TIMES: Record<string, LeadTime> = {
  "growth-hormone-pen": {
    badge: "2-Week Wait",
    notice:
      "This item is currently made to order. Please allow a two-week wait time before dispatch.",
  },
};

export function getLeadTime(slug: string): LeadTime | undefined {
  return LEAD_TIMES[slug];
}
