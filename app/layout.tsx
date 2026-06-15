import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AgeGate from "@/components/AgeGate";
import WhatsAppFloatingButton from "@/components/WhatsAppFloatingButton";
import { Analytics } from "@vercel/analytics/next";

const inter = Space_Grotesk({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "31-32 Peptides | Research-Grade Peptides UK",
    template: "%s | 31-32 Peptides",
  },
  description:
    "UK supplier of high-purity research peptides for in-vitro laboratory use. Every batch independently tested with Certificate of Analysis. Quick UK delivery.",
  keywords: [
    "research peptides UK",
    "buy peptides UK",
    "peptide supplier UK",
    "BPC-157 UK",
    "TB-500 UK",
    "research compounds",
    "in-vitro research",
  ],
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "31-32 Peptides",
    title: "31-32 Peptides | Research-Grade Peptides UK",
    description:
      "UK supplier of high-purity research peptides for in-vitro laboratory use. Every batch independently tested.",
  },
  twitter: {
    card: "summary_large_image",
    title: "31-32 Peptides | Research-Grade Peptides UK",
    description:
      "UK supplier of high-purity research peptides for in-vitro laboratory use.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AgeGate />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <WhatsAppFloatingButton />
        <Analytics />
      </body>
    </html>
  );
}
