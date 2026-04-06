import { Suspense } from "react";
import PricingSuccessClient from "@/components/pricing/PricingSuccessClient";

export const metadata = {
  title: "Payment Success | GenuineTrade",
  description: "Your GenuineTrade subscription payment was successful."
};

export default function PricingSuccessPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-canvas" />}>
      <PricingSuccessClient />
    </Suspense>
  );
}
