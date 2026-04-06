import { Suspense } from "react";
import PricingPageClient from "@/components/pricing/PricingPageClient";

export const metadata = {
  title: "Pricing | GenuineTrade",
  description: "Choose the right GenuineTrade subscription plan for your trade volume."
};

export default function PricingPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-canvas" />}>
      <PricingPageClient />
    </Suspense>
  );
}
