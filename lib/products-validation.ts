// ---------------------------------------------------------------------------
// 31-32 Peptides -- request body validation for the admin products API
// ---------------------------------------------------------------------------
//
// The admin form serialises the product as JSON. Before we hand the body to
// `upsertProduct` we run it through this validator to catch missing fields,
// wrong types, and obviously-bad values (negative prices, unknown formats,
// invalid slugs, duplicate variant SKUs). Returning a string from any of
// these helpers means "validation failed -- here is the error to surface to
// the admin"; returning the typed object means "good to go".
//
// Length caps + URL allow-listing live in lib/sanitize.ts. We treat every
// string that lands in the DB as untrusted -- even though only the admin
// can hit this route -- so that a stolen session, a phishing-induced edit,
// or a careless paste can't fill the catalogue with multi-MB blobs or
// "javascript:" image URLs.

import type { ProductWriteInput } from "./products-db";
import type { BundleItem, ProductVariant } from "./types";
import {
  FIELD_LIMITS,
  boundedString,
  safeUrl,
  stripControlChars,
} from "./sanitize";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKU_RE = /^[A-Z0-9][A-Z0-9-]*$/;
const VALID_FORMATS = ["vial", "pen", "nasal"] as const;

// Hosts product images may legitimately come from. The Vercel Blob host
// pattern matches what next.config.ts already allow-lists for <Image>.
// Same-origin /images/* paths are handled by safeUrl's relative branch.
const ALLOWED_IMAGE_HOSTS = ["*.public.blob.vercel-storage.com"];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === "string");
}

function trimmedString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return stripControlChars(v).trim();
}

export function validateVariants(
  raw: unknown,
): { variants: ProductVariant[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "At least one variant is required." };
  }
  if (raw.length > 20) {
    return { error: "A product can have at most 20 variants." };
  }

  const seenSkus = new Set<string>();
  const variants: ProductVariant[] = [];

  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    if (!isObject(v)) return { error: `Variant ${i + 1}: expected an object.` };

    const weight = trimmedString(v.weight);
    const sku = trimmedString(v.sku);
    const price = typeof v.price === "number" ? v.price : Number(v.price);

    if (!weight) return { error: `Variant ${i + 1}: weight is required.` };
    if (weight.length > 40) {
      return { error: `Variant ${i + 1}: weight is too long.` };
    }
    if (!sku) return { error: `Variant ${i + 1}: SKU is required.` };
    if (sku.length > 60) {
      return { error: `Variant ${i + 1}: SKU is too long.` };
    }
    if (!SKU_RE.test(sku)) {
      return {
        error: `Variant ${i + 1}: SKU "${sku}" should be uppercase letters, digits, or hyphens.`,
      };
    }
    if (seenSkus.has(sku)) {
      return { error: `Variant ${i + 1}: SKU "${sku}" is repeated.` };
    }
    seenSkus.add(sku);

    if (!Number.isFinite(price) || price < 0) {
      return {
        error: `Variant ${i + 1}: price must be a non-negative number.`,
      };
    }
    // Cap price at £100,000 -- a sanity check against fat-finger entries
    // that would otherwise rewrite an invoice into something absurd.
    if (price > 100_000) {
      return { error: `Variant ${i + 1}: price is unreasonably high.` };
    }

    // Sale price (compareAtPrice) -- optional. Must be > price (otherwise
    // no discount), capped at the same upper bound as price. We treat
    // null/undefined/empty as "no sale" and just drop the field.
    let compareAtPrice: number | undefined;
    if (
      v.compareAtPrice !== undefined &&
      v.compareAtPrice !== null &&
      v.compareAtPrice !== ""
    ) {
      const cap =
        typeof v.compareAtPrice === "number"
          ? v.compareAtPrice
          : Number(v.compareAtPrice);
      if (!Number.isFinite(cap) || cap < 0) {
        return {
          error: `Variant ${i + 1}: compareAtPrice must be a non-negative number.`,
        };
      }
      if (cap > 100_000) {
        return { error: `Variant ${i + 1}: compareAtPrice is unreasonably high.` };
      }
      if (cap > 0 && cap <= price) {
        return {
          error: `Variant ${i + 1}: compareAtPrice (£${cap.toFixed(2)}) must be greater than the sale price (£${price.toFixed(2)}). Leave it blank if there's no sale.`,
        };
      }
      if (cap > price) {
        compareAtPrice = cap;
      }
    }

    const variant: ProductVariant = { weight, sku, price };
    if (compareAtPrice !== undefined) variant.compareAtPrice = compareAtPrice;
    variants.push(variant);
  }

  return { variants };
}

export interface ParsedProductBody {
  input: ProductWriteInput;
}

/**
 * Validates the body of a product create/update request and returns either
 * a typed input object ready for upsertProduct, or an error string.
 *
 * `expectedSlug` lets the PUT route enforce that the body's slug matches the
 * URL slug -- pass undefined for the POST (create) route.
 */
export function parseProductBody(
  body: unknown,
  options: { expectedSlug?: string } = {},
): ParsedProductBody | { error: string } {
  if (!isObject(body)) return { error: "Request body must be a JSON object." };

  const slug = trimmedString(body.slug);
  if (!slug) return { error: "slug is required." };
  if (slug.length > FIELD_LIMITS.slug) return { error: "slug is too long." };
  if (!SLUG_RE.test(slug)) {
    return {
      error: 'slug must be lowercase letters, digits, and single hyphens (e.g. "my-product-10mg").',
    };
  }
  if (options.expectedSlug && slug !== options.expectedSlug) {
    return {
      error: `slug in body ("${slug}") does not match URL slug ("${options.expectedSlug}").`,
    };
  }

  const name = trimmedString(body.name);
  if (!name) return { error: "name is required." };
  if (name.length > FIELD_LIMITS.name) return { error: "name is too long." };

  const category = trimmedString(body.category);
  if (!category) return { error: "category is required." };
  if (category.length > FIELD_LIMITS.category) {
    return { error: "category is too long." };
  }

  const description = trimmedString(body.description);
  if (!description) return { error: "description is required." };
  if (description.length > FIELD_LIMITS.description) {
    return { error: "description is too long." };
  }

  // Optional strings -- default to empty string when missing. Each is bounded
  // to its declared field limit so an oversized input is truncated rather
  // than rejected outright (the admin never has to fight a hard wall).
  const researchContext = boundedString(
    trimmedString(body.researchContext) ?? "",
    "researchContext",
  );
  const purity = boundedString(trimmedString(body.purity) ?? "", "purity");
  const storageInstructions = boundedString(
    trimmedString(body.storageInstructions) ?? "",
    "storageInstructions",
  );
  const molecularWeight = boundedString(
    trimmedString(body.molecularWeight) ?? "",
    "molecularWeight",
  );
  const sequence = boundedString(
    trimmedString(body.sequence) ?? "",
    "sequence",
  );

  // Certificate-of-analysis URL: optional, but if present must be https
  // (or a same-origin /images path) so it can't ship a "javascript:" URI to
  // every storefront visitor via the COA download link.
  const rawCoa = trimmedString(body.coaUrl) ?? "";
  let coaUrl = "";
  if (rawCoa) {
    if (rawCoa.length > FIELD_LIMITS.coaUrl) {
      return { error: "coaUrl is too long." };
    }
    const safe = safeUrl(rawCoa, { allowRelative: true });
    if (!safe) {
      return {
        error: "coaUrl must be an https URL or a /-relative path.",
      };
    }
    coaUrl = safe;
  }

  const inStock =
    typeof body.inStock === "boolean" ? body.inStock : true;
  const contactForPrice =
    typeof body.contactForPrice === "boolean" ? body.contactForPrice : false;
  // Storefront visibility -- defaults to true for backwards compatibility
  // with older callers that don't supply the flag.
  const storefrontVisible =
    typeof body.storefrontVisible === "boolean"
      ? body.storefrontVisible
      : true;

  // Arrays -- must all be string[] or absent.
  const rawImages = body.images === undefined ? [] : body.images;
  if (!isStringArray(rawImages)) {
    return { error: "images must be an array of strings." };
  }
  if (rawImages.length > 12) {
    return { error: "A product can have at most 12 images." };
  }
  const images: string[] = [];
  for (const candidate of rawImages) {
    const t = stripControlChars(candidate).trim();
    if (!t) continue;
    if (t.length > FIELD_LIMITS.imageUrl) {
      return { error: "An image URL is too long." };
    }
    const safe = safeUrl(t, {
      allowRelative: true,
      allowedHosts: ALLOWED_IMAGE_HOSTS,
    });
    if (!safe) {
      return {
        error: `Image URL "${t.slice(0, 80)}" is not allowed. Use the upload button or paste a /images/* path.`,
      };
    }
    images.push(safe);
  }

  const rawTags = body.tags === undefined ? [] : body.tags;
  if (!isStringArray(rawTags)) {
    return { error: "tags must be an array of strings." };
  }
  if (rawTags.length > 30) return { error: "Too many tags." };
  const tags: string[] = [];
  for (const tag of rawTags) {
    const t = stripControlChars(tag).trim();
    if (!t) continue;
    if (t.length > FIELD_LIMITS.tag) {
      return { error: `Tag "${t.slice(0, 40)}" is too long.` };
    }
    tags.push(t);
  }

  const rawRelated = body.relatedSlugs === undefined ? [] : body.relatedSlugs;
  if (!isStringArray(rawRelated)) {
    return { error: "relatedSlugs must be an array of strings." };
  }
  if (rawRelated.length > 30) return { error: "Too many related slugs." };
  const relatedSlugs: string[] = [];
  for (const r of rawRelated) {
    const t = stripControlChars(r).trim();
    if (!t) continue;
    if (t.length > FIELD_LIMITS.slug || !SLUG_RE.test(t)) {
      return {
        error: `Related slug "${t.slice(0, 40)}" is not a valid slug.`,
      };
    }
    relatedSlugs.push(t);
  }

  // Format -- nullable enum.
  let format: ProductWriteInput["format"] = null;
  if (body.format !== undefined && body.format !== null && body.format !== "") {
    if (
      typeof body.format !== "string" ||
      !VALID_FORMATS.includes(body.format as (typeof VALID_FORMATS)[number])
    ) {
      return {
        error: `format must be one of: ${VALID_FORMATS.join(", ")}, or empty.`,
      };
    }
    format = body.format as ProductWriteInput["format"];
  }

  // Bulk deal -- optional trio. Either all set or none. (We do not enforce
  // the relationship strictly; the admin form decides.)
  const rawBulk = trimmedString(body.bulkDeal);
  let bulkDeal: string | null = null;
  if (rawBulk) {
    if (rawBulk.length > FIELD_LIMITS.bulkDeal) {
      return { error: "bulkDeal headline is too long." };
    }
    bulkDeal = rawBulk;
  }
  const bulkDealQty =
    body.bulkDealQty === undefined || body.bulkDealQty === null
      ? null
      : Number(body.bulkDealQty);
  if (bulkDealQty !== null && (!Number.isFinite(bulkDealQty) || bulkDealQty < 1 || bulkDealQty > 1000)) {
    return { error: "bulkDealQty must be a positive integer up to 1000." };
  }
  const bulkDealPrice =
    body.bulkDealPrice === undefined || body.bulkDealPrice === null
      ? null
      : Number(body.bulkDealPrice);
  if (
    bulkDealPrice !== null &&
    (!Number.isFinite(bulkDealPrice) || bulkDealPrice < 0 || bulkDealPrice > 100_000)
  ) {
    return { error: "bulkDealPrice must be a non-negative number." };
  }

  // Bundle support -- when isBundle is true, bundleItems must be a non-empty
  // array of {productSlug, weight, label?} entries with at least two items.
  // (A "bundle" of one product is just a product.)
  const isBundle =
    typeof body.isBundle === "boolean" ? body.isBundle : false;
  let bundleItems: BundleItem[] = [];
  if (isBundle) {
    if (!Array.isArray(body.bundleItems)) {
      return { error: "bundleItems must be an array when isBundle is true." };
    }
    if (body.bundleItems.length < 2) {
      return {
        error:
          "A bundle needs at least two constituent items. Add another item or untick the bundle flag.",
      };
    }
    if (body.bundleItems.length > 12) {
      return { error: "A bundle can have at most 12 items." };
    }
    const seen = new Set<string>();
    for (let i = 0; i < body.bundleItems.length; i++) {
      const raw = body.bundleItems[i];
      if (!isObject(raw)) {
        return { error: `Bundle item ${i + 1}: expected an object.` };
      }
      const productSlug = trimmedString(raw.productSlug);
      const weight = trimmedString(raw.weight);
      const label = trimmedString(raw.label);
      if (!productSlug) {
        return {
          error: `Bundle item ${i + 1}: productSlug is required.`,
        };
      }
      if (productSlug.length > FIELD_LIMITS.slug || !SLUG_RE.test(productSlug)) {
        return {
          error: `Bundle item ${i + 1}: productSlug "${productSlug.slice(0, 40)}" is not a valid slug.`,
        };
      }
      if (productSlug === slug) {
        return {
          error: `Bundle item ${i + 1}: a bundle cannot include itself.`,
        };
      }
      if (!weight) {
        return { error: `Bundle item ${i + 1}: weight is required.` };
      }
      if (weight.length > 40) {
        return { error: `Bundle item ${i + 1}: weight is too long.` };
      }
      // Allow the same product to appear once at each weight, but reject the
      // same {slug, weight} combo twice -- it's almost certainly an admin
      // mistake (and renders as a duplicate row in the bundle UI).
      const key = `${productSlug}|${weight}`;
      if (seen.has(key)) {
        return {
          error: `Bundle item ${i + 1}: ${productSlug} (${weight}) is listed twice.`,
        };
      }
      seen.add(key);

      const item: BundleItem = { productSlug, weight };
      if (label) {
        if (label.length > 200) {
          return { error: `Bundle item ${i + 1}: label is too long.` };
        }
        item.label = label;
      }
      bundleItems.push(item);
    }
  }

  // Variants
  const variantResult = validateVariants(body.variants);
  if ("error" in variantResult) return { error: variantResult.error };

  // Position is optional; the create route will assign one if not provided.
  const position =
    typeof body.position === "number" && Number.isFinite(body.position)
      ? body.position
      : undefined;

  return {
    input: {
      slug,
      name,
      category,
      description,
      researchContext,
      purity,
      coaUrl,
      storageInstructions,
      molecularWeight,
      sequence,
      inStock,
      images,
      tags,
      relatedSlugs,
      format,
      contactForPrice,
      bulkDeal,
      bulkDealQty,
      bulkDealPrice,
      storefrontVisible,
      isBundle,
      bundleItems,
      ...(position !== undefined ? { position } : {}),
      variants: variantResult.variants,
    },
  };
}
