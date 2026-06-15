// ---------------------------------------------------------------------------
// Bundle "What's included" section -- shown on the storefront product detail
// page when a product is flagged as a bundle.
//
// Resolves each bundle item against the live catalogue so links and labels
// reflect current product names + variants. Items whose constituent product
// has been removed or hidden from the storefront are skipped silently --
// we'd rather render an incomplete bundle than a dead link to /products/X.
// ---------------------------------------------------------------------------

import Link from "next/link";
import Image from "next/image";
import type { BundleItem, Product } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

interface ResolvedBundleItem {
  item: BundleItem;
  product: Product;
  // The variant whose `weight` matches the bundle item, or the first variant
  // as a graceful fallback when the listed weight no longer exists. We still
  // show the listed weight in the UI either way -- the variant lookup is
  // only used for the per-item price preview.
  variantPrice: number | null;
}

function resolveBundleItems(
  bundle: Product,
  catalogue: Product[],
): ResolvedBundleItem[] {
  const resolved: ResolvedBundleItem[] = [];
  for (const item of bundle.bundleItems ?? []) {
    const product = catalogue.find((p) => p.slug === item.productSlug);
    if (!product) continue; // dropped: constituent missing or hidden
    const variant =
      product.variants.find((v) => v.weight === item.weight) ??
      product.variants[0];
    resolved.push({
      item,
      product,
      variantPrice: variant ? variant.price : null,
    });
  }
  return resolved;
}

interface BundleContentsProps {
  bundle: Product;
  catalogue: Product[];
}

export default function BundleContents({
  bundle,
  catalogue,
}: BundleContentsProps) {
  if (!bundle.isBundle) return null;
  const resolved = resolveBundleItems(bundle, catalogue);
  if (resolved.length === 0) return null;

  // "Buy separately" total -- sum of the constituent variant prices when all
  // are known. We only show it when every item resolves to a price, since
  // a partial sum would mislead. The bundle's own price is `variants[0].price`
  // (bundles in this codebase tend to be single-variant -- if that ever
  // changes, the cheapest variant is still the right floor for the
  // "from £X" comparison).
  const allPriced = resolved.every((r) => r.variantPrice !== null);
  const separateTotal = allPriced
    ? resolved.reduce((sum, r) => sum + (r.variantPrice ?? 0), 0)
    : null;
  const bundlePrice = bundle.variants[0]?.price ?? null;
  const savings =
    separateTotal !== null && bundlePrice !== null && separateTotal > bundlePrice
      ? separateTotal - bundlePrice
      : 0;

  return (
    <section className="mt-12 rounded-2xl border border-[#2563EB]/20 bg-gradient-to-b from-[#1A2439] to-white p-6 sm:p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge className="mb-2 bg-[#2563EB] text-white">Bundle</Badge>
          <h2 className="text-xl font-bold text-[#F5F7FB] sm:text-2xl">
            What&rsquo;s included
          </h2>
          <p className="mt-1 text-sm text-[#B0BBD1]">
            This bundle ships as one order. Click any item below for full
            details and research context.
          </p>
        </div>
        {savings > 0 && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-right">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-700">
              Save vs separately
            </p>
            <p className="text-lg font-bold text-emerald-700">
              &pound;{savings.toFixed(2)}
            </p>
          </div>
        )}
      </div>

      <ul className="space-y-3">
        {resolved.map(({ item, product, variantPrice }) => (
          <li key={`${item.productSlug}-${item.weight}`}>
            <Link
              href={`/products/${product.slug}`}
              className="group flex items-center gap-4 rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-3 transition-shadow hover:shadow-md sm:p-4"
            >
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gradient-to-b from-[#1A2439] to-white sm:h-20 sm:w-20">
                {product.images?.[0] && (
                  <Image
                    src={product.images[0]}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#F5F7FB] group-hover:text-[#2563EB] sm:text-base">
                  {item.label ?? product.name}
                </p>
                <p className="mt-0.5 text-xs text-[#8A96AC] sm:text-sm">
                  {item.weight} &middot; {product.category}
                </p>
                {item.label && (
                  // Render the underlying product name when the admin gave
                  // the line a custom label, so the buyer can still see what
                  // they're getting.
                  <p className="mt-0.5 text-[11px] text-[#8A96AC]">
                    Includes: {product.name}
                  </p>
                )}
              </div>
              {variantPrice !== null && (
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wider text-[#8A96AC]">
                    Solo
                  </p>
                  <p className="text-sm font-semibold text-[#8A96AC]">
                    &pound;{variantPrice.toFixed(2)}
                  </p>
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
