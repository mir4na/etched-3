import "./globals.css";
import { Inter, Outfit } from "next/font/google";
import type { Metadata, Viewport } from "next";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-heading", weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "Etched | Soulbound Certificates",
  description: "Web3 platform for issuing tamper-proof academic credentials as Soulbound Tokens (SBT).",
  keywords: ["soulbound token", "SBT", "certificate", "diploma", "blockchain", "Web3", "Ethereum"],
  authors: [{ name: "Etched Team" }],
  metadataBase: new URL("https://etched.app"),
  openGraph: {
    title: "Etched - Soulbound Certificate Platform",
    description: "Mint tamper-proof diplomas and certificates on blockchain.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body>{children}</body>
    </html>
  );
}
