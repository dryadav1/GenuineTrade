import { Suspense } from "react";
import PricingCheckoutClient from "@/components/pricing/PricingCheckoutClient";

export const metadata = {
  title: "Checkout | GenuineTrade",
  description: "Choose your payment provider and confirm your GenuineTrade plan upgrade."
};

export default function PricingCheckoutPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-canvas" />}>
      <PricingCheckoutClient />
    </Suspense>
  );
}
