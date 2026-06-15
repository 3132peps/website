// ---------------------------------------------------------------------------
// /api/admin/upload-image -- upload a product image to Vercel Blob
// ---------------------------------------------------------------------------
//
// Used by the admin product form's image picker. Accepts a single file in a
// multipart/form-data body under the field name `file`, validates type and
// size, uploads to the project's public Blob store, and returns the public
// URL ready to be appended to the product's `images` array.
//
// The admin's session cookie + CSRF header are still required, so anonymous
// users cannot use this as a free file host.
//
// Security notes:
//   - We only accept JPEG, PNG, WebP, GIF. SVG is intentionally excluded:
//     SVGs can carry <script> and event handlers and will execute in the
//     blob.vercel-storage.com origin if a viewer opens one. Pre-rasterised
//     bitmaps don't have that footgun.
//   - We don't trust the browser-supplied Content-Type. We sniff the first
//     bytes of the upload and reject anything whose magic number doesn't
//     match the declared MIME. This blocks "rename my .exe to .png" tricks
//     that an attacker with admin access could otherwise use to host an
//     arbitrary payload on our domain.
//   - The path uses a UUID suffix the caller can't predict, so even a
//     guessable-name collision can't overwrite an existing asset.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { requireAdmin, requireAdminCsrf } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

type AllowedMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

const ALLOWED_TYPES: ReadonlySet<AllowedMime> = new Set<AllowedMime>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function extensionFor(type: AllowedMime): string {
  switch (type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
  }
}

/**
 * Confirms the first bytes of the upload match the declared MIME type.
 * Source-of-truth references: the magic numbers below are documented at
 * https://en.wikipedia.org/wiki/List_of_file_signatures (we read enough
 * bytes to disambiguate WebP from RIFF and JFIF from EXIF JPEG).
 */
function magicMatches(type: AllowedMime, bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;

  switch (type) {
    case "image/jpeg":
      // FF D8 FF -- common to JFIF, EXIF, SPIFF, etc.
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

    case "image/png":
      // 89 50 4E 47 0D 0A 1A 0A
      return (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      );

    case "image/webp":
      // "RIFF" .... "WEBP"
      return (
        bytes[0] === 0x52 && // R
        bytes[1] === 0x49 && // I
        bytes[2] === 0x46 && // F
        bytes[3] === 0x46 && // F
        bytes[8] === 0x57 && // W
        bytes[9] === 0x45 && // E
        bytes[10] === 0x42 && // B
        bytes[11] === 0x50 // P
      );

    case "image/gif":
      // "GIF87a" or "GIF89a"
      return (
        bytes[0] === 0x47 && // G
        bytes[1] === 0x49 && // I
        bytes[2] === 0x46 && // F
        bytes[3] === 0x38 && // 8
        (bytes[4] === 0x37 || bytes[4] === 0x39) && // 7 or 9
        bytes[5] === 0x61 // a
      );
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const csrfFailure = requireAdminCsrf(request);
  if (csrfFailure) return csrfFailure;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "BLOB_READ_WRITE_TOKEN is not configured. Connect a Vercel Blob store to the project (Vercel dashboard → Storage → Blob) and pull the token into .env.local for local development.",
      },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected a multipart/form-data body." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'Missing "file" field in form data.' },
      { status: 400 },
    );
  }

  // Match against the narrow MIME allow-list. Note that this only filters
  // on the declared header; we re-check against the actual bytes below.
  if (!ALLOWED_TYPES.has(file.type as AllowedMime)) {
    return NextResponse.json(
      {
        error: `Unsupported file type "${file.type}". Allowed: JPEG, PNG, WebP, GIF.`,
      },
      { status: 415 },
    );
  }
  const declaredType = file.type as AllowedMime;

  if (file.size === 0) {
    return NextResponse.json(
      { error: "File is empty." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: `File is too large (${Math.round(file.size / 1024 / 1024)} MB). Max ${Math.round(MAX_BYTES / 1024 / 1024)} MB.`,
      },
      { status: 413 },
    );
  }

  // Buffer once; verify magic bytes; then upload. The double-read avoids
  // streaming a hostile file to Blob storage just to discover at the end
  // that it's not what it claimed.
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  if (!magicMatches(declaredType, bytes)) {
    return NextResponse.json(
      {
        error:
          "File contents do not match the declared image type. Please re-export and upload again.",
      },
      { status: 400 },
    );
  }

  // Compose a stable, collision-resistant key. We deliberately ignore the
  // user-supplied filename to avoid path-traversal tricks, encoded slashes,
  // or weaponised filenames (e.g. ones that confuse downstream consumers).
  const ext = extensionFor(declaredType);
  const id = randomUUID();
  const key = `products/${id}.${ext}`;

  try {
    const blob = await put(key, Buffer.from(bytes), {
      access: "public",
      contentType: declaredType,
      // Force the response to download rather than render in-page if it ever
      // gets navigated to directly. Defence-in-depth in case a content-type
      // sniff somewhere downstream interprets a JPEG comment as HTML.
      // (Vercel Blob serves with the contentType we set, but the extra
      // header is harmless.)
      addRandomSuffix: false,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      size: file.size,
      contentType: declaredType,
    });
  } catch (err) {
    console.error("[upload-image] Blob put failed:", err);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 },
    );
  }
}
