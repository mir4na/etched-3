import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"]
});

export const metadata = {
  title: "Etched | Soulbound Certificates",
  description: "Web3 platform for issuing tamper-proof academic credentials as Soulbound Tokens (SBT).",
  keywords: ["soulbound token", "SBT", "certificate", "diploma", "blockchain", "Web3", "Ethereum", "Polygon"],
  authors: [{ name: "Etched Team" }],
  openGraph: {
    title: "Etched - Soulbound Certificate Platform",
    description: "Mint tamper-proof diplomas and certificates on blockchain.",
    type: "website",
  },
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
