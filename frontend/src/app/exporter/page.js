import RoleLandingPage from "@/components/marketing/RoleLandingPage";

const stats = [
  {
    label: "Verification",
    value: "4-step",
    detail: "Role confirmation, business details, documents, and guided review."
  },
  {
    label: "Discovery",
    value: "RFQ-ready",
    detail: "Move from profile setup into ranked buyer opportunities with less friction."
  },
  {
    label: "Trust",
    value: "Visible",
    detail: "Verification status, document readiness, and cleaner messaging reinforce credibility."
  }
];

const pillars = [
  {
    title: "Structured exporter onboarding",
    description: "Capture IEC, GST, HSN, products, and supporting files in a guided flow that feels built for serious trade operations."
  },
  {
    title: "Premium dashboard operations",
    description: "Keep listings, RFQs, messages, verification assets, and subscription state in one consistent workspace."
  },
  {
    title: "Better signal before outreach",
    description: "Trust-first profiles help buyers understand readiness before they start a procurement conversation."
  }
];

export default function ExporterPage() {
  return (
    <RoleLandingPage
      ctaLabel="Start as exporter"
      eyebrow="For exporters"
      pillars={pillars}
      stats={stats}
      subtitle="Give your export team a cleaner path from onboarding to verification, buyer discovery, RFQs, and trusted conversations."
      title="A polished exporter workspace built for credibility, not chaos."
    />
  );
}
