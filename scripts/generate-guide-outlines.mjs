#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Generates outline-only draft guides for every visible peptide product.
//
// For each product we emit two MDX files in data/guides/:
//   - <slug>-overview.mdx           (type: peptide-overview)
//   - <slug>-reconstitution.mdx     (type: reconstitution)
//
// Each draft contains:
//   - status: draft  (hidden from /guides + sitemap, visible only to
//                     /admin/content-graph reviewers)
//   - the locked section structure for its type
//   - suggestedWords per section (so a human writer has a target)
//   - factualClaims arrays listing items that must be verified before publish
//   - relatedProducts: the parent product + a sibling in the same category
//   - relatedGuides: the matching counterpart guide + a sibling guide
//
// Idempotent: re-running it overwrites the scaffolds (which is fine while
// they're drafts -- once a human starts editing a guide they should flip
// status to "published" and the script will refuse to overwrite that
// file). Run it whenever a new product is added so the scaffold pair
// shows up automatically.
//
// Usage: node scripts/generate-guide-outlines.mjs
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PRODUCTS_PATH = resolve(ROOT, "data", "products.json");
const GUIDES_DIR = resolve(ROOT, "data", "guides");

const products = JSON.parse(readFileSync(PRODUCTS_PATH, "utf8"));

// Outlines are only generated for "peptide-style" research compounds. We
// drop lab supplies (bacteriostatic water etc.) -- they don't get a
// peptide-overview or reconstitution guide.
function isPeptideProduct(p) {
  return (
    p.category &&
    !/lab supplies/i.test(p.category) &&
    !/bacteriostatic/i.test(p.slug ?? "")
  );
}

// Storefront-visible peptide products only -- per spec, "each peptide
// currently in the catalogue (22 products)". The visibility filter lives
// in the DB but the JSON snapshot mirrors it for build-time generators.
function isVisible(p) {
  // The DB column is the truth source -- the JSON has `inStock` but no
  // visibility flag. Since the DB has 22 visible peptides, we trust
  // baseline JSON's contents minus the 8 admin-only pen products.
  const ADMIN_ONLY_SLUGS = new Set([
    "tirzepatide-elv8-pen",
    "retatrutide-elv8-pen",
    "synedica-retatrutide-pen",
    "nad-plus-pen",
    "ghk-cu-pen",
    "wolverine-pen",
    "glow-pen",
    "klow-pen",
  ]);
  return !ADMIN_ONLY_SLUGS.has(p.slug);
}

const targets = products.filter(isPeptideProduct).filter(isVisible);
console.log(`Generating outlines for ${targets.length} peptide products`);

// ---------------------------------------------------------------------------
// Outline templates -- locked section structure per type, with suggested
// word counts and per-section factualClaims that frame the verification
// work the human writer must do before publish.
// ---------------------------------------------------------------------------

function overviewOutline(product) {
  const compoundName = product.name;
  return [
    {
      heading: "Introduction",
      suggestedWords: 220,
      factualClaims: [
        `Brief description of ${compoundName} as a research compound (avoid any human-use framing).`,
        `Year of first reported synthesis or laboratory characterisation.`,
        `Why it is studied in vitro -- broad mechanism category only.`,
      ],
    },
    {
      heading: "Molecular Structure",
      suggestedWords: 200,
      factualClaims: [
        `Molecular formula and molar mass (verify against a peer-reviewed source).`,
        `Amino-acid sequence in single-letter notation, with any non-standard residues called out explicitly.`,
        `Notable structural features (e.g. cyclic backbone, fatty-acid moiety, D-amino-acid substitutions).`,
      ],
    },
    {
      heading: "Research Context",
      suggestedWords: 320,
      factualClaims: [
        `Receptor or pathway targets reported in the in-vitro literature.`,
        `Two to three peer-reviewed studies the section can cite (provide DOI links).`,
        `Open scientific questions the compound is currently used to investigate.`,
      ],
    },
    {
      heading: "Common Research Applications",
      suggestedWords: 260,
      factualClaims: [
        `Cell-line / model systems most often used in published in-vitro work.`,
        `Typical assay endpoints (signalling readouts, gene-expression panels, etc.).`,
        `Limitations: what in-vitro models cannot tell us about whole-organism behaviour.`,
      ],
    },
    {
      heading: "Related Compounds",
      suggestedWords: 180,
      factualClaims: [
        `Two structurally or mechanistically similar peptides for comparison context.`,
        `Brief note on what differentiates ${compoundName} from each.`,
      ],
    },
    {
      heading: "Related Products",
      suggestedWords: 90,
      factualClaims: [
        `Internal links to the relevant Elv8 Wellness product pages must use the canonical /products/<slug> URL.`,
        `Confirm each linked product is currently in the catalogue.`,
      ],
    },
    {
      heading: "Further Reading",
      suggestedWords: 140,
      factualClaims: [
        `At least three external references -- prefer review papers from the last 5 years.`,
        `Each link must be to a stable DOI or journal URL, not a press article.`,
      ],
    },
  ];
}

function reconstitutionOutline(product) {
  const compoundName = product.name;
  // First variant weight is a useful default in the volumes table.
  const firstVariant = product.variants?.[0];
  const variantWeight = firstVariant?.weight ?? "10mg";
  return [
    {
      heading: "Overview",
      suggestedWords: 160,
      factualClaims: [
        `Confirm ${compoundName} ships lyophilised (or otherwise) -- update wording to match.`,
        `Solvent compatibility: bacteriostatic water, sterile water, or other (verify with the supplier batch sheet).`,
      ],
    },
    {
      heading: "Required Materials",
      suggestedWords: 180,
      factualClaims: [
        `Recommended bacteriostatic water grade (USP, BP, or research-grade equivalent).`,
        `Syringe / needle gauge typically used for transfer in laboratory protocols.`,
        `Vial preparation: alcohol swab, ambient temperature handling, etc.`,
      ],
    },
    {
      heading: "Standard Concentration Calculations",
      suggestedWords: 220,
      factualClaims: [
        `Worked example using the ${variantWeight} vial size.`,
        `Recommended starting concentration band, with rationale (NOT a dose).`,
        `Cross-link to /calculator?compound=${product.slug} so the reader can re-run the maths.`,
      ],
    },
    {
      heading: "Storage After Reconstitution",
      suggestedWords: 160,
      factualClaims: [
        `Refrigerator temperature window (2-8 °C is the established norm; verify).`,
        `Recommended use-by window once reconstituted (often 14-28 days; verify against literature).`,
        `Avoid-freezing rationale and light-sensitivity notes specific to ${compoundName}.`,
      ],
    },
    {
      heading: "Common Volumes Table",
      suggestedWords: 140,
      factualClaims: [
        `Three rows showing different bacteriostatic-water volumes against the resulting concentration for the ${variantWeight} vial.`,
        `Numbers must match what the calculator returns -- spot-check at least one row before publishing.`,
      ],
    },
    {
      heading: "Related Products",
      suggestedWords: 90,
      factualClaims: [
        `Internal links to the relevant Elv8 Wellness product pages must use the canonical /products/<slug> URL.`,
        `Confirm each linked product is currently in the catalogue.`,
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Sibling resolution -- pick a "buddy" product for relatedProducts and
// a partner guide for relatedGuides so the internal-linking floor is met.
// ---------------------------------------------------------------------------

function siblingProduct(product, all) {
  // Prefer same category; fall back to next product in array.
  const sameCategory = all.find(
    (p) => p.slug !== product.slug && p.category === product.category,
  );
  if (sameCategory) return sameCategory.slug;
  const idx = all.findIndex((p) => p.slug === product.slug);
  return all[(idx + 1) % all.length]?.slug ?? product.slug;
}

function siblingGuide(product, all, suffix) {
  // Pick another visible peptide for "Further Reading". The buddy guide
  // points at the same suffix (overview <-> overview, recon <-> recon)
  // for thematic consistency.
  const buddy = all.find((p) => p.slug !== product.slug);
  return buddy ? `${buddy.slug}${suffix}` : null;
}

// ---------------------------------------------------------------------------
// MDX writer with YAML frontmatter (manually serialised so we don't pull in
// a yaml dependency just for the generator).
// ---------------------------------------------------------------------------

function yamlEscape(s) {
  return String(s).replace(/"/g, '\\"');
}

function frontmatterToYaml(fm) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(fm)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else if (typeof value[0] === "string") {
        lines.push(`${key}:`);
        for (const v of value) lines.push(`  - "${yamlEscape(v)}"`);
      } else {
        // Outline: array of objects with heading / suggestedWords / factualClaims
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - heading: "${yamlEscape(item.heading)}"`);
          if (item.suggestedWords !== undefined) {
            lines.push(`    suggestedWords: ${item.suggestedWords}`);
          }
          if (item.factualClaims && item.factualClaims.length > 0) {
            lines.push(`    factualClaims:`);
            for (const c of item.factualClaims) {
              lines.push(`      - "${yamlEscape(c)}"`);
            }
          }
        }
      }
    } else if (typeof value === "string") {
      lines.push(`${key}: "${yamlEscape(value)}"`);
    } else if (value === null || value === undefined) {
      // skip
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

const TODAY = new Date().toISOString().slice(0, 10);

let written = 0;
let skippedPublished = 0;

for (const product of targets) {
  const overviewSlug = `${product.slug}-overview`;
  const reconSlug = `${product.slug}-reconstitution`;

  const sibling = siblingProduct(product, targets);
  const overviewSibling = siblingGuide(product, targets, "-overview");
  const reconSibling = siblingGuide(product, targets, "-reconstitution");

  // Each pair points at each other plus a sibling -- meets the >=2
  // relatedGuides floor.
  const overviewRelatedGuides = [reconSlug, overviewSibling].filter(Boolean);
  const reconRelatedGuides = [overviewSlug, reconSibling].filter(Boolean);

  const overviewBody = `

<!-- This file is an outline-only scaffold. The body is intentionally empty
     until a human writer fills in the prose. The structured outline in the
     frontmatter drives the rendered "Outline" view at /admin/content-graph
     and the section list shown to readers in draft mode. -->
`.trimStart();

  const overviewFrontmatter = {
    title: `${product.name}: Overview`,
    slug: overviewSlug,
    type: "peptide-overview",
    status: "draft",
    summary: `Outline scaffold for the ${product.name} peptide overview guide. Awaiting prose from a human reviewer.`,
    relatedProducts: [product.slug, sibling].filter(
      (v, i, arr) => arr.indexOf(v) === i,
    ),
    relatedGuides: overviewRelatedGuides,
    author: "Elv8 Research Team",
    datePublished: TODAY,
    dateModified: TODAY,
    outline: overviewOutline(product),
  };

  const reconFrontmatter = {
    title: `${product.name}: Reconstitution Guide`,
    slug: reconSlug,
    type: "reconstitution",
    status: "draft",
    summary: `Outline scaffold for the ${product.name} reconstitution guide. Awaiting prose from a human reviewer.`,
    relatedProducts: [product.slug, sibling].filter(
      (v, i, arr) => arr.indexOf(v) === i,
    ),
    relatedGuides: reconRelatedGuides,
    author: "Elv8 Research Team",
    datePublished: TODAY,
    dateModified: TODAY,
    outline: reconstitutionOutline(product),
  };

  for (const [slug, fm] of [
    [overviewSlug, overviewFrontmatter],
    [reconSlug, reconFrontmatter],
  ]) {
    const filePath = resolve(GUIDES_DIR, `${slug}.mdx`);
    if (existsSync(filePath)) {
      const existing = readFileSync(filePath, "utf8");
      // Refuse to overwrite a guide that has been promoted to published.
      // Once a human starts editing, the script must not stomp on it.
      if (/^status:\s*"?published"?\s*$/m.test(existing)) {
        skippedPublished += 1;
        continue;
      }
    }
    const yaml = frontmatterToYaml(fm);
    writeFileSync(filePath, `${yaml}\n${overviewBody}`);
    written += 1;
  }
}

console.log("");
console.log(`Done. wrote=${written}  skipped-published=${skippedPublished}`);
