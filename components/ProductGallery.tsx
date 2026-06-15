"use client";

import { useState } from "react";
import Image from "next/image";

interface ProductGalleryProps {
  images: string[];
  productName: string;
}

// Product-page image gallery: a main viewer plus a clickable thumbnail strip.
// The main image uses object-contain (never object-cover) so the full photo
// is always visible regardless of its aspect ratio -- the gradient backdrop
// fills any letterboxing. The strip only renders when there is more than one
// image, so single-image products look exactly as before.
export default function ProductGallery({
  images,
  productName,
}: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-[#1A2439] to-white aspect-square">
        <Image
          key={images[activeIndex]}
          src={images[activeIndex]}
          alt={`${productName}${activeIndex > 0 ? ` — view ${activeIndex + 1}` : ""}`}
          fill
          className="object-contain"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority={activeIndex === 0}
        />
      </div>

      {images.length > 1 && (
        <div className="flex gap-3">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`Show image ${i + 1} of ${images.length}`}
              aria-current={i === activeIndex}
              className={`relative h-20 w-20 shrink-0 rounded-lg overflow-hidden bg-gradient-to-b from-[#1A2439] to-white border-2 transition-colors ${
                i === activeIndex
                  ? "border-[#2563EB]"
                  : "border-transparent hover:border-[#2563EB]/40"
              }`}
            >
              <Image
                src={src}
                alt=""
                fill
                className="object-contain"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
