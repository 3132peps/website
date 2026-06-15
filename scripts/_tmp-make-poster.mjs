#!/usr/bin/env node
// TEMP: generate the Elv8 "Updated Pricing" poster (original design, red brand).
// Outputs a high-res PNG and a vector SVG. Scale: node _tmp-make-poster.mjs 5
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const OUT_PNG = resolve(root, "..", "Elv8-Pricing-Poster.png");
const OUT_SVG = resolve(root, "..", "Elv8-Pricing-Poster.svg");
const SCALE = Number(process.argv[2]) || 5;

const logoB64 = readFileSync(resolve(root, "public/images/elv8-logo.png")).toString("base64");

const PENS = [
  ["Retatrutide Elv8 Pen (40mg)", 100],
  ["Retatrutide & Cagrilintide Pen (20mg/10mg)", 130],
  ["Synedica Retatrutide Pens (40mg)", 120],
  ["Tirzepatide Elv8 Pen (40mg)", 100],
  ["Cagrilintide Pen (10mg)", 65],
  ["Growth Hormone (Somatropin) Pen (108iu)", 108],
  ["Tesamorelin Pen (20mg)", 85],
  ["CJC-1295 & Ipamorelin Pen (10mg/10mg)", 65],
  ["GHK-Cu Pen (100mg)", 60],
  ["Wolverine Pen (10mg/10mg)", 80],
  ["GLOW Pen (70mg)", 75],
  ["KLOW Pen (80mg)", 85],
  ["NAD+ Pen (1000mg)", 120],
  ["MOTS-c Pen (40mg)", 65],
  ["SLU-PP-332 Pen (5mg)", 40],
  ["Elamipretide (SS-31) Pen (10mg)", 30],
  ["Limitless Pen (Semax & Selank) (10mg/10mg)", 65],
  ["Bremelanotide (PT-141) Pen (10mg)", 35],
  ["Melanotan II Pen (10mg)", 30],
];

// Elv8 brand palette
const RED = "#E31E26";   // brand red (accents, sampled from logo)
const INK = "#262A2E";   // neutral charcoal (dark text)
const MUTED = "#9AA0A6"; // muted grey
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const W = 1300, H = 2180;

function hexagon(cx, cy, r) {
  const pts = [];
  for (let k = 0; k < 6; k++) {
    const a = (-90 + 60 * k) * Math.PI / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

const hexCluster = [
  [980, 150, 60], [1075, 205, 60], [980, 262, 60],
  [1170, 150, 60], [1075, 95, 60], [1170, 262, 44],
];
let motif = `<g stroke="${RED}" stroke-width="2" fill="none" opacity="0.26">`;
for (const [cx, cy, r] of hexCluster) motif += `<polygon points="${hexagon(cx, cy, r)}"/>`;
const links = [[0,1],[1,2],[0,4],[1,3],[1,5]];
for (const [a,b] of links) motif += `<line x1="${hexCluster[a][0]}" y1="${hexCluster[a][1]}" x2="${hexCluster[b][0]}" y2="${hexCluster[b][1]}"/>`;
motif += `</g><g fill="${RED}" opacity="0.5">`;
for (const [cx, cy] of hexCluster) motif += `<circle cx="${cx}" cy="${cy}" r="5"/>`;
motif += `</g>`;
let faint = `<g stroke="${RED}" stroke-width="2.5" fill="none" opacity="0.05">`;
faint += `<polygon points="${hexagon(150, 1820, 150)}"/><polygon points="${hexagon(300, 1900, 150)}"/><polygon points="${hexagon(1180, 1550, 130)}"/>`;
faint += `</g>`;

const cardX = 70, cardY = 486, cardW = 1160, cardH = 1452;
const rowY0 = 520, rowH = 74;
let rows = "";
PENS.forEach(([name, price], i) => {
  const top = rowY0 + i * rowH;
  const cy = top + rowH / 2;
  if (i > 0) rows += `<line x1="118" y1="${top}" x2="${cardX + cardW - 48}" y2="${top}" stroke="#EFEFF1" stroke-width="1.2"/>`;
  rows += `<circle cx="130" cy="${cy}" r="19" fill="#FBEAEB"/>`;
  rows += `<rect x="123" y="${cy - 11}" width="14" height="9" rx="2" fill="${RED}" opacity="0.55"/>`;
  rows += `<rect x="123" y="${cy - 4}" width="14" height="15" rx="3" fill="${RED}"/>`;
  rows += `<text x="172" y="${cy + 10}" font-family="Helvetica, Arial, sans-serif" font-size="31" font-weight="500" fill="${INK}">${esc(name)}</text>`;
  rows += `<line x1="1046" y1="${cy - 21}" x2="1046" y2="${cy + 21}" stroke="#DCDDE0" stroke-width="1.5"/>`;
  rows += `<text x="1196" y="${cy + 11}" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="35" font-weight="bold" fill="${RED}">£${price}</text>`;
});

function feature(cx, label, icon) {
  return `<g transform="translate(${cx},2002)">${icon}
    <text x="0" y="62" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="bold" letter-spacing="1" fill="${INK}">${label}</text></g>`;
}
const icoShield = `<g fill="none" stroke="${RED}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M0,-20 L18,-12 V2 C18,14 10,20 0,24 C-10,20 -18,14 -18,2 V-12 Z"/><polyline points="-8,2 -2,8 9,-5"/></g>`;
const icoBox = `<g fill="none" stroke="${RED}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M-18,-8 L0,-18 L18,-8 V14 L0,24 L-18,14 Z"/><path d="M-18,-8 L0,2 L18,-8"/><path d="M0,2 V24"/></g>`;
const icoFlask = `<g fill="none" stroke="${RED}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M-6,-20 H6 M-4,-20 V-4 L-16,18 C-18,22 -15,26 -10,26 H10 C15,26 18,22 16,18 L4,-4 V-20"/><path d="M-11,10 H11"/></g>`;
const footer = `${feature(310, "VERIFIED PURITY", icoShield)}${feature(650, "UK DISPATCHED", icoBox)}${feature(990, "RESEARCH USE ONLY", icoFlask)}
  <line x1="480" y1="1992" x2="480" y2="2052" stroke="#DCDDE0" stroke-width="1.5"/>
  <line x1="820" y1="1992" x2="820" y2="2052" stroke="#DCDDE0" stroke-width="1.5"/>`;

function buildSvg(scale) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * scale}" height="${H * scale}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F5F6F7"/><stop offset="0.5" stop-color="#FBFBFC"/><stop offset="1" stop-color="#FFFFFF"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${faint}
  ${motif}
  <image x="70" y="64" width="257" height="92" href="data:image/png;base64,${logoB64}"/>
  <text x="68" y="306" font-family="Helvetica, Arial, sans-serif" font-size="104" font-weight="bold" fill="${INK}">UPDATED</text>
  <text x="68" y="416" font-family="Helvetica, Arial, sans-serif" font-size="104" font-weight="bold" fill="${RED}">PRICING</text>
  <rect x="72" y="442" width="140" height="10" rx="5" fill="${RED}"/>
  <text x="690" y="360" font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="500" letter-spacing="3" fill="${MUTED}">PEPTIDE PEN RANGE</text>
  <rect x="${cardX}" y="${cardY + 8}" width="${cardW}" height="${cardH}" rx="28" fill="${RED}" opacity="0.06"/>
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="28" fill="#FFFFFF" stroke="#E6E7EA" stroke-width="2"/>
  ${rows}
  ${footer}
  <text x="${W / 2}" y="2126" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#7C8187">All products are supplied strictly for in-vitro laboratory research use only — not for human consumption.</text>
</svg>`;
}

writeFileSync(OUT_SVG, buildSvg(1), "utf8");
await sharp(Buffer.from(buildSvg(SCALE))).png().toFile(OUT_PNG);
console.log(`Wrote PNG ${W * SCALE}x${H * SCALE} -> ${OUT_PNG}`);
console.log(`Wrote SVG (vector) -> ${OUT_SVG}`);
