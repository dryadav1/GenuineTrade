import { IBM_Plex_Mono, Manrope } from "next/font/google";
import "react-phone-input-2/lib/style.css";
import AppProviders from "@/components/providers/AppProviders";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans"
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
  variable: "--font-mono"
});

export const metadata = {
  title: "GenuineTrade",
  description: "Premium B2B trade infrastructure for exporters, buyers, and trust-led payments."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${manrope.variable} ${ibmPlexMono.variable}`}>
      <body className="antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
