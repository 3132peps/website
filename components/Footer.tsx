import Link from "next/link";
import Image from "next/image";
import PurchaseDisclaimer from "@/components/PurchaseDisclaimer";

export default function Footer() {
  return (
    <footer className="bg-[#1B2A3D] text-white">
      {/* RUO Disclaimer */}
      <div className="w-full bg-[#162436] border-t border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-sm italic text-[#8A96AC] leading-relaxed">
            All products supplied by 31-32 Peptides are intended
            strictly for in-vitro laboratory research purposes only (Research
            Use Only / RUO). Products are not intended for human or veterinary
            consumption, administration, medical treatment, diagnostic
            procedures, cosmetic application, or any therapeutic purpose.
          </p>
        </div>
      </div>

      {/* Purchase Disclaimer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <PurchaseDisclaimer variant="dark" />
      </div>

      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Column 1: Company Info */}
          <div>
            <Image
              src="/images/3132-logo.jpg"
              alt="31-32 Peptides"
              width={120}
              height={120}
              className="h-16 w-auto mb-3 rounded-lg bg-[#121A2B] p-1"
            />
            <p className="text-gray-300 mb-4">
              Research-Grade Peptides. Verified Purity. UK Dispatched.
            </p>
            <p className="text-[#8A96AC] text-sm">
              <a
                href="mailto:info@31-32peptides.com"
                className="hover:text-white transition-colors"
              >
                info@31-32peptides.com
              </a>
            </p>
            <div className="mt-5">
              <a
                href="https://wa.me/447404817580"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1ead55]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Chat with us on WhatsApp
              </a>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/products"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Products
                </Link>
              </li>
              <li>
                <Link
                  href="/calculator"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Calculator
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Legal */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/faq"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  FAQ
                </Link>
              </li>
              <li>
                <Link
                  href="/shipping"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Shipping &amp; Returns
                </Link>
              </li>
              <li>
                <Link
                  href="/research-use-disclaimer"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Research Use Disclaimer
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-[#8A96AC] text-sm">
            &copy; 2026 31-32 Peptides. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
