import RoleLandingPage from "@/components/marketing/RoleLandingPage";

const stats = [
  {
    label: "RFQs",
    value: "Structured",
    detail: "Capture quantity, budget, country, and supplier intent without messy spreadsheets."
  },
  {
    label: "Supplier search",
    value: "Qualified",
    detail: "Review verification state and trust posture before you open a chat or submit a trade."
  },
  {
    label: "Messaging",
    value: "Centralized",
    detail: "Keep supplier conversations, saved counterparts, and RFQ context together."
  }
];

const pillars = [
  {
    title: "Buyer onboarding that gets out of the way",
    description: "Confirm your role, add business details, verify your phone, and move into procurement workflows without dead ends."
  },
  {
    title: "Cleaner sourcing operations",
    description: "Search exporters, create RFQs, save strong suppliers, and keep trade decisions organized from one dashboard."
  },
  {
    title: "Trust-led procurement",
    description: "Verification status and structured supplier data help your team move faster with fewer risky conversations."
  }
];

export default function BuyerPage() {
  return (
    <RoleLandingPage
      ctaLabel="Start as buyer"
      eyebrow="For buyers"
      pillars={pillars}
      stats={stats}
      subtitle="Turn procurement intent into clean RFQs, trusted supplier discovery, and faster conversations with verified exporters."
      title="A buyer workspace designed to make global sourcing feel calm and controlled."
    />
  );
}
