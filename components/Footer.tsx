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
