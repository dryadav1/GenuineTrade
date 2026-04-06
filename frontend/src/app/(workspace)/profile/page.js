"use client";

import { useEffect, useState } from "react";
import ActionModal from "@/components/common/ActionModal";
import EmptyState from "@/components/common/EmptyState";
import LoadingGrid from "@/components/common/LoadingGrid";
import PaginationControls from "@/components/common/PaginationControls";
import AppShell from "@/components/app/AppShell";
import FormField from "@/components/FormField";
import SectionCard from "@/components/SectionCard";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import { useToastOnChange } from "@/components/feedback/ToastProvider";
import { apiRequest } from "@/lib/api";
import { openProtectedFile, readFileAsDataUrl } from "@/lib/files";
import { formatCurrency, formatDate, formatScore } from "@/lib/format";
import { useWorkspaceSession } from "@/lib/workspace";

const initialAdminOverride = {
  open: false,
  subscriptionId: "",
  planCode: "free",
  billingCycle: "monthly",
  status: "active",
  notes: ""
};

const verificationDocumentConfig = [
  {
    documentType: "iec",
    title: "IEC certificate",
    description: "Required for export eligibility and IEC code validation."
  },
  {
    documentType: "gst",
    title: "GST certificate",
    description: "Used to validate GST format and registered entity identity."
  },
  {
    documentType: "bank_proof",
    title: "Bank proof",
    description: "Cancelled cheque, bank letter, or account proof for payouts."
  }
];

const inferDocumentMimeType = (file) => {
  if (file.type) {
    return file.type;
  }

  const lowerFileName = String(file.name || "").toLowerCase();

  if (lowerFileName.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (lowerFileName.endsWith(".png")) {
    return "image/png";
  }

  if (lowerFileName.endsWith(".jpg") || lowerFileName.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (lowerFileName.endsWith(".webp")) {
    return "image/webp";
  }

  return "";
};

const buildProfileFormState = (role, profile) => ({
  companyName: profile?.companyName || "",
  country: profile?.country || "",
  businessId: profile?.businessId || "",
  businessType: profile?.businessType || "",
  importProducts: (profile?.importProducts || []).join(", "),
  products: (profile?.products || []).join(", "),
  certifications: (profile?.certifications || []).join(", "),
  gstNumber: profile?.gstNumber || "",
  iecCode: profile?.iecCode || ""
});

export default function ProfilePage() {
  const { session, ready, updateSessionUser } = useWorkspaceSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [subscriptionPage, setSubscriptionPage] = useState(1);
  const [billingLoading, setBillingLoading] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [uploadingDocumentType, setUploadingDocumentType] = useState("");
  const [submittingKyc, setSubmittingKyc] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [adminOverride, setAdminOverride] = useState(initialAdminOverride);
  const [data, setData] = useState(null);
  const [profileForm, setProfileForm] = useState(() =>
    buildProfileFormState("buyer", null)
  );

  useToastOnChange({
    errorMessage: error,
    successMessage: notice,
    errorTitle: "Profile issue",
    successTitle: "Profile updated"
  });

  const loadData = async () => {
    if (!session) {
      return;
    }

    if (session.user.role === "buyer") {
      const [buyerData, subscriptionData, transactionData, notificationData] =
        await Promise.all([
        apiRequest("/buyers/me", { token: session.token }),
        apiRequest("/subscriptions/me", { token: session.token }),
        apiRequest("/transactions?page=1&limit=8", { token: session.token }),
        apiRequest("/notifications/settings", { token: session.token })
      ]);

      setData({
        profile: buyerData.buyer,
        summary: buyerData,
        subscription: subscriptionData,
        transactions: transactionData,
        notificationSettings: notificationData.settings
      });
      setProfileForm(buildProfileFormState("buyer", buyerData.buyer));
      return;
    }

    if (session.user.role === "exporter") {
      const [exporterData, subscriptionData, transactionData, notificationData] =
        await Promise.all([
        apiRequest("/exporters/me", { token: session.token }),
        apiRequest("/subscriptions/me", { token: session.token }),
        apiRequest("/transactions?page=1&limit=8", { token: session.token }),
        apiRequest("/notifications/settings", { token: session.token })
      ]);

      setData({
        profile: exporterData.exporter,
        summary: exporterData,
        subscription: subscriptionData,
        transactions: transactionData,
        notificationSettings: notificationData.settings
      });
      setProfileForm(buildProfileFormState("exporter", exporterData.exporter));
      return;
    }

    const [subscriptionData, transactionData, notificationData] = await Promise.all([
      apiRequest(`/admin/subscriptions?page=${subscriptionPage}&limit=8`, {
        token: session.token
      }),
      apiRequest("/admin/transactions?page=1&limit=8", { token: session.token }),
      apiRequest("/notifications/settings", { token: session.token })
    ]);

    setData({
      subscription: subscriptionData,
      transactions: transactionData,
      notificationSettings: notificationData.settings
    });
  };

  const syncProfile = (profile) => {
    setData((current) =>
      current
        ? {
            ...current,
            profile,
            summary: {
              ...(current.summary || {}),
              [session?.user?.role === "buyer" ? "buyer" : "exporter"]: profile
            }
          }
        : current
    );
    setProfileForm(buildProfileFormState(session?.user?.role || "buyer", profile));
  };

  useEffect(() => {
    if (!ready || !session) {
      return;
    }

    const run = async () => {
      setLoading(true);
      setError("");

      try {
        await loadData();
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [ready, session, subscriptionPage]);

  const updateTransaction = async (transactionId, action, reason = "") => {
    try {
      const response = await apiRequest(`/transactions/${transactionId}/${action}`, {
        method: "POST",
        token: session.token,
        body: reason ? { reason } : undefined
      });

      setData((current) => ({
        ...current,
        transactions: {
          ...current.transactions,
          items: current.transactions.items.map((item) =>
            item.id === transactionId ? response.transaction : item
          )
        }
      }));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handlePlanChange = async (planCode, billingCycle = "monthly") => {
    if (planCode !== "free") {
      window.location.href = `/pricing/checkout?plan=${planCode}&billingCycle=${
        billingCycle === "annual" ? "yearly" : billingCycle
      }`;
      return;
    }

    setBillingLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await apiRequest("/subscriptions/checkout", {
        method: "POST",
        token: session.token,
        body: {
          planCode,
          billingCycle,
          successUrl: `${window.location.origin}/pricing/success`,
          cancelUrl: `${window.location.origin}/pricing?checkout=cancelled`
        }
      });

      updateSessionUser({
        ...session.user,
        subscriptionPlan: response.subscription?.planCode || "free",
        planStartDate: response.subscription?.currentPeriodStart || null,
        planExpiry: response.subscription?.currentPeriodEnd || null
      });

      setNotice(
        response.checkout?.provider === "test_mode"
          ? "Subscription updated in local test mode."
          : response.message
      );
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBillingLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setBillingLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await apiRequest("/subscriptions/cancel", {
        method: "POST",
        token: session.token
      });

      setNotice(response.message);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBillingLoading(false);
    }
  };

  const submitAdminOverride = async (event) => {
    event.preventDefault();
    setBillingLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await apiRequest(
        `/admin/subscriptions/${adminOverride.subscriptionId}`,
        {
          method: "PATCH",
          token: session.token,
          body: {
            planCode: adminOverride.planCode,
            billingCycle: adminOverride.billingCycle,
            status: adminOverride.status,
            notes: adminOverride.notes
          }
        }
      );

      setNotice(response.message);
      setAdminOverride(initialAdminOverride);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBillingLoading(false);
    }
  };

  const updateNotificationPreference = async (channel, key, value) => {
    setNotificationLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await apiRequest("/notifications/settings", {
        method: "PATCH",
        token: session.token,
        body: {
          [channel]: {
            [key]: value
          }
        }
      });

      setData((current) => ({
        ...current,
        notificationSettings: response.settings
      }));
      setNotice("Notification settings updated");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setNotificationLoading(false);
    }
  };

  const sendOtp = async () => {
    setNotificationLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await apiRequest("/notifications/otp/send", {
        method: "POST",
        token: session.token,
        body: {
          purpose: "phone_verification"
        }
      });

      setNotice(`${response.message}. Expires in ${response.expiresInSeconds} seconds.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setNotificationLoading(false);
    }
  };

  const verifyOtp = async () => {
    setNotificationLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await apiRequest("/notifications/otp/verify", {
        method: "POST",
        token: session.token,
        body: {
          purpose: "phone_verification",
          code: otpCode
        }
      });

      setOtpCode("");
      setNotice(response.message);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setNotificationLoading(false);
    }
  };

  const handleProfileFormChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const saveProfileDetails = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    setError("");
    setNotice("");

    try {
      const endpoint =
        role === "buyer" ? "/buyers/me/profile" : "/exporters/me/profile";
      const response = await apiRequest(endpoint, {
        method: "PATCH",
        token: session.token,
        body:
          role === "buyer"
            ? {
                companyName: profileForm.companyName,
                country: profileForm.country,
                businessId: profileForm.businessId,
                businessType: profileForm.businessType,
                importProducts: profileForm.importProducts
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
                certifications: profileForm.certifications
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              }
            : {
                companyName: profileForm.companyName,
                country: profileForm.country,
                gstNumber: profileForm.gstNumber,
                iecCode: profileForm.iecCode,
                products: profileForm.products
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
                certifications: profileForm.certifications
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              }
      });

      syncProfile(response.buyer || response.exporter);
      setNotice(response.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleVerificationDocumentUpload = async (documentType, fileList) => {
    const file = fileList?.[0];

    if (!file || !session?.token) {
      return;
    }

    const mimeType = inferDocumentMimeType(file);

    if (!mimeType) {
      setError("Only PDF, PNG, JPG, and WEBP files are supported for KYC uploads.");
      return;
    }

    setUploadingDocumentType(documentType);
    setError("");
    setNotice("");

    try {
      const fileBase64 = await readFileAsDataUrl(file);
      const response = await apiRequest("/exporters/me/verification-documents", {
        method: "POST",
        token: session.token,
        body: {
          documentType,
          fileName: file.name,
          mimeType,
          fileBase64
        }
      });

      syncProfile(response.exporter);
      setNotice(`${response.document.label} uploaded successfully.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUploadingDocumentType("");
    }
  };

  const handleSubmitKycForReview = async () => {
    setSubmittingKyc(true);
    setError("");
    setNotice("");

    try {
      const response = await apiRequest("/exporters/me/verification/submit", {
        method: "POST",
        token: session.token
      });

      syncProfile(response.exporter);
      setNotice(response.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmittingKyc(false);
    }
  };

  const handleOpenVerificationDocument = async (downloadPath) => {
    if (!session?.token || !downloadPath) {
      return;
    }

    setError("");

    try {
      await openProtectedFile(downloadPath, session.token);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  if (!ready || !session || loading) {
    return (
      <AppShell
        session={session || { user: { role: "buyer", email: "Loading" } }}
        title="Profile and billing"
        subtitle="Loading subscription, usage, and payment operations."
      >
        <LoadingGrid count={4} />
      </AppShell>
    );
  }

  const role = session.user.role;

  if (!data) {
    return (
      <AppShell
        session={session}
        title="Profile and billing"
        subtitle="Identity, monetization, access limits, and payment operations stay visible in one operating surface."
      >
        {error ? <div className="panel p-5 text-sm text-danger">{error}</div> : null}
        <EmptyState
          title="Profile data is unavailable"
          description="We couldn't load your profile details right now. Refresh the page or try again after the profile service is reachable."
        />
      </AppShell>
    );
  }

  const verificationDocuments = data.profile?.verificationDocuments || [];
  const verificationDocumentsByType = verificationDocuments.reduce((map, document) => {
    map[document.documentType] = document;
    return map;
  }, {});
  const kycSummary = data.profile?.kycSummary || {
    readyForReview: false,
    missingDocumentTypes: [],
    validations: {},
    documentStatuses: []
  };

  return (
    <AppShell
      session={session}
      title="Profile and billing"
      subtitle="Identity, monetization, access limits, and payment operations stay visible in one operating surface."
    >
      {error ? <div className="panel p-5 text-sm text-danger">{error}</div> : null}
      {notice ? <div className="panel p-5 text-sm text-success">{notice}</div> : null}

      {role !== "admin" ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <SectionCard
              eyebrow="Identity"
              title="Company profile"
              description="Trust starts with clean company information and plan-aware visibility."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="surface-muted p-5">
                  <p className="text-sm text-muted">GenuineTrade ID</p>
                  <p className="mt-2 text-lg font-semibold text-primary">
                    {session.user.publicId || "Pending"}
                  </p>
                </div>
                <div className="surface-muted p-5">
                  <p className="text-sm text-muted">Company</p>
                  <p className="mt-2 text-lg font-semibold text-primary">
                    {data.profile.companyName}
                  </p>
                </div>
                <div className="surface-muted p-5">
                  <p className="text-sm text-muted">Country</p>
                  <p className="mt-2 text-lg font-semibold text-primary">
                    {data.profile.country}
                  </p>
                </div>
                <div className="surface-muted p-5">
                  <p className="text-sm text-muted">Email</p>
                  <p className="mt-2 text-lg font-semibold text-primary">
                    {data.profile.user?.email}
                  </p>
                </div>
                <div className="surface-muted p-5">
                  <p className="text-sm text-muted">Phone</p>
                  <p className="mt-2 text-lg font-semibold text-primary">
                    {data.profile.user?.phone}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {role === "buyer" ? (
                  <>
                    <div className="surface-muted p-5">
                      <p className="text-sm text-muted">Business type</p>
                      <p className="mt-2 text-lg font-semibold text-primary">
                        {data.profile.businessType || "Not set"}
                      </p>
                    </div>
                    <div className="surface-muted p-5">
                      <p className="text-sm text-muted">Import products</p>
                      <p className="mt-2 text-lg font-semibold text-primary">
                        {data.profile.importProducts?.length
                          ? data.profile.importProducts.join(", ")
                          : "Not set"}
                      </p>
                    </div>
                    <div className="surface-muted p-5">
                      <p className="text-sm text-muted">Certifications</p>
                      <p className="mt-2 text-lg font-semibold text-primary">
                        {data.profile.certifications?.length
                          ? data.profile.certifications.join(", ")
                          : "None added"}
                      </p>
                    </div>
                    <div className="surface-muted p-5">
                      <p className="text-sm text-muted">Trust and KYC</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusBadge value={data.profile.kycStatus} />
                        <span className="text-lg font-semibold text-primary">
                          {formatScore(data.profile.trustScore)}
                        </span>
                      </div>
                    </div>
                  </>
                ) : null}

                {role === "exporter" ? (
                  <>
                    <div className="surface-muted p-5">
                      <p className="text-sm text-muted">Products</p>
                      <p className="mt-2 text-lg font-semibold text-primary">
                        {data.profile.products?.length
                          ? data.profile.products.join(", ")
                          : "Not set"}
                      </p>
                    </div>
                    <div className="surface-muted p-5">
                      <p className="text-sm text-muted">Certifications</p>
                      <p className="mt-2 text-lg font-semibold text-primary">
                        {data.profile.certifications?.length
                          ? data.profile.certifications.join(", ")
                          : "None added"}
                      </p>
                    </div>
                    <div className="surface-muted p-5">
                      <p className="text-sm text-muted">Trust badge</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusBadge value={data.profile.status} />
                        <StatusBadge value={data.profile.verificationStage} />
                      </div>
                    </div>
                    <div className="surface-muted p-5">
                      <p className="text-sm text-muted">Trust score</p>
                      <p className="mt-2 text-lg font-semibold text-primary">
                        {formatScore(data.profile.trustScore)}
                      </p>
                    </div>
                  </>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Plan"
              title="Subscription overview"
              description="Every new account starts on Starter for free, then upgrades as trade volume and visibility needs increase."
            >
              <div className="surface-muted p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge value={data.subscription.subscription.status} />
                  <p className="text-xl font-semibold text-primary">
                    {data.subscription.subscription.planName}
                  </p>
                </div>
                <p className="mt-3 text-sm text-muted">
                  Billing cycle: {data.subscription.subscription.billingCycle} | Next charge:{" "}
                  {formatDate(data.subscription.subscription.nextChargeAt)}
                </p>
                <p className="mt-2 text-sm text-muted">
                  Amount:{" "}
                  {formatCurrency(
                    data.subscription.subscription.amount,
                    data.subscription.subscription.currency
                  )}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {data.subscription.subscription.features.map((feature) => (
                    <span
                      key={feature}
                      className="rounded-full bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
                {data.subscription.subscription.planCode !== "free" ? (
                  <div className="mt-5">
                    <button
                      className="btn-secondary"
                      disabled={billingLoading}
                      onClick={handleCancelSubscription}
                      type="button"
                    >
                      {billingLoading ? "Updating..." : "Cancel auto-renewal"}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <StatCard
                  label="RFQs this month"
                  value={data.subscription.subscription.usage?.rfqs.used || 0}
                  detail={`Limit ${
                    data.subscription.subscription.usage?.rfqs.limitLabel || "Unlimited"
                  }`}
                />
                <StatCard
                  label="Matches this month"
                  value={data.subscription.subscription.usage?.matches.used || 0}
                  detail={`Limit ${
                    data.subscription.subscription.usage?.matches.limitLabel || "Unlimited"
                  }`}
                />
              </div>
            </SectionCard>
          </div>

          <div className="mt-6">
            <SectionCard
              eyebrow="Profile"
              title={role === "buyer" ? "Buyer marketplace profile" : "Exporter marketplace profile"}
              description={
                role === "buyer"
                  ? "Keep your sourcing intent current so recommendations, saved exporters, and marketplace discovery stay relevant."
                  : "Maintain your product and certification details so buyers can find and trust your profile."
              }
            >
              <form className="grid gap-4 lg:grid-cols-2" onSubmit={saveProfileDetails}>
                <FormField
                  label="Company name"
                  name="companyName"
                  onChange={handleProfileFormChange}
                  value={profileForm.companyName}
                />
                <FormField
                  label="Country"
                  name="country"
                  onChange={handleProfileFormChange}
                  value={profileForm.country}
                />

                {role === "buyer" ? (
                  <>
                    <FormField
                      label="Business ID"
                      name="businessId"
                      onChange={handleProfileFormChange}
                      placeholder="Import registration, internal ID, or tax identifier"
                      value={profileForm.businessId}
                    />
                    <FormField
                      label="Business type"
                      name="businessType"
                      onChange={handleProfileFormChange}
                      placeholder="Importer, distributor, retailer"
                      value={profileForm.businessType}
                    />
                    <FormField
                      label="Import products"
                      name="importProducts"
                      onChange={handleProfileFormChange}
                      placeholder="Turmeric, rice, tea"
                      rows={4}
                      value={profileForm.importProducts}
                    />
                    <FormField
                      label="Certifications"
                      name="certifications"
                      onChange={handleProfileFormChange}
                      placeholder="Organic, ISO 22000, GMP"
                      rows={4}
                      value={profileForm.certifications}
                    />
                  </>
                ) : (
                  <>
                    <FormField
                      label="GST number"
                      name="gstNumber"
                      onChange={handleProfileFormChange}
                      value={profileForm.gstNumber}
                    />
                    <FormField
                      label="IEC code"
                      name="iecCode"
                      onChange={handleProfileFormChange}
                      value={profileForm.iecCode}
                    />
                    <FormField
                      label="Products"
                      name="products"
                      onChange={handleProfileFormChange}
                      placeholder="Turmeric powder, rice, tea"
                      rows={4}
                      value={profileForm.products}
                    />
                    <FormField
                      label="Certifications"
                      name="certifications"
                      onChange={handleProfileFormChange}
                      placeholder="FSSAI, ISO 22000, Organic"
                      rows={4}
                      value={profileForm.certifications}
                    />
                  </>
                )}

                <div className="lg:col-span-2">
                  <button className="btn-primary" disabled={profileSaving} type="submit">
                    {profileSaving ? "Saving profile..." : "Save marketplace profile"}
                  </button>
                </div>
              </form>
            </SectionCard>
          </div>

          {role === "exporter" ? (
            <div className="mt-6">
              <SectionCard
                eyebrow="KYC"
                title="Verification and payout readiness"
                description="Keep your compliance pack complete, preview the latest uploads, and submit the full set for admin review."
              >
                <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                  <div className="surface-muted p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={data.profile.verificationStage} />
                      <StatusBadge value={data.profile.approvalState} />
                    </div>
                    <p className="mt-4 text-lg font-semibold text-primary">
                      {kycSummary.readyForReview
                        ? "Your verification pack is ready for review."
                        : "Complete every required document before submitting."}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-muted">
                      Missing documents:{" "}
                      {kycSummary.missingDocumentTypes?.length
                        ? kycSummary.missingDocumentTypes
                            .map((documentType) => documentType.replaceAll("_", " "))
                            .join(", ")
                        : "None"}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-line bg-canvas px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
                          IEC format
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <StatusBadge
                            value={
                              kycSummary.validations?.iec?.status || "not_applicable"
                            }
                          />
                          <span className="text-sm text-primary">
                            {data.profile.iecCode || "Not set"}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-line bg-canvas px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
                          GST format
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <StatusBadge
                            value={
                              kycSummary.validations?.gst?.status || "not_applicable"
                            }
                          />
                          <span className="text-sm text-primary">
                            {data.profile.gstNumber || "Not set"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-5">
                      <button
                        className="btn-primary"
                        disabled={
                          submittingKyc ||
                          !kycSummary.readyForReview ||
                          data.profile.verificationStage === "under_review"
                        }
                        onClick={handleSubmitKycForReview}
                        type="button"
                      >
                        {submittingKyc ? "Submitting..." : "Submit for review"}
                      </button>
                    </div>
                    {data.profile.verificationNotes ? (
                      <div className="mt-4 rounded-2xl border border-line bg-canvas px-4 py-4 text-sm text-muted">
                        Admin notes: {data.profile.verificationNotes}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {verificationDocumentConfig.map((item) => {
                      const document = verificationDocumentsByType[item.documentType];
                      const validation =
                        item.documentType === "bank_proof"
                          ? null
                          : kycSummary.validations?.[item.documentType];

                      return (
                        <div key={item.documentType} className="surface-muted p-5">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
                            {item.title}
                          </p>
                          <p className="mt-3 text-sm leading-7 text-muted">
                            {item.description}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <StatusBadge value={document?.status || "missing"} />
                            {validation?.status ? (
                              <StatusBadge value={validation.status} />
                            ) : null}
                          </div>
                          <div className="mt-4 space-y-2 text-sm text-primary">
                            <p>{document?.fileName || "No file uploaded yet"}</p>
                            <p className="text-muted">
                              {document ? `Version ${document.version}` : "Waiting for upload"}
                            </p>
                            {document?.reviewRemarks ? (
                              <p className="text-danger">{document.reviewRemarks}</p>
                            ) : null}
                            {validation?.issues?.length ? (
                              <p className="text-danger">{validation.issues.join(", ")}</p>
                            ) : null}
                          </div>
                          <div className="mt-5 flex flex-wrap gap-3">
                            <label className="btn-secondary cursor-pointer">
                              {uploadingDocumentType === item.documentType
                                ? "Uploading..."
                                : document
                                  ? "Replace file"
                                  : "Upload file"}
                              <input
                                accept=".pdf,image/png,image/jpeg,image/webp"
                                className="hidden"
                                disabled={uploadingDocumentType === item.documentType}
                                onChange={(event) => {
                                  void handleVerificationDocumentUpload(
                                    item.documentType,
                                    event.target.files
                                  );
                                  event.target.value = "";
                                }}
                                type="file"
                              />
                            </label>
                            {document?.downloadPath ? (
                              <button
                                className="btn-secondary"
                                onClick={() =>
                                  handleOpenVerificationDocument(document.downloadPath)
                                }
                                type="button"
                              >
                                View file
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </SectionCard>
            </div>
          ) : null}

          <div className="mt-6">
            <SectionCard
              eyebrow="Upgrade"
              title="Choose the plan that fits your trade volume"
              description="Free gets you started, Starter adds more volume, Growth unlocks featured premium access, and Enterprise is built for full control."
            >
              <div className="grid gap-4 lg:grid-cols-4">
                {data.subscription.plans.map((plan) => {
                  const currentPlanCode = data.subscription.subscription.planCode;
                  const isCurrent = currentPlanCode === plan.code;

                  return (
                    <div key={plan.code} className="surface-muted p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
                        {plan.tier}
                      </p>
                      <p className="mt-3 text-2xl font-bold text-primary">{plan.name}</p>
                      <p className="mt-2 text-sm text-muted">
                        {plan.monthlyPrice === 0
                          ? "Free forever"
                          : `${formatCurrency(plan.monthlyPrice)} / month`}
                      </p>
                      <div className="mt-4 space-y-2 text-sm text-muted">
                        {plan.features.map((feature) => (
                          <p key={`${plan.code}-${feature}`}>{feature}</p>
                        ))}
                      </div>
                      <div className="mt-4 space-y-1 text-xs text-primary/55">
                        <p>RFQs/month: {plan.limits.rfqsPerMonth}</p>
                        <p>Matches/month: {plan.limits.matchesPerMonth}</p>
                      </div>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          className={isCurrent ? "btn-secondary" : "btn-primary"}
                          disabled={billingLoading || isCurrent}
                          onClick={() => handlePlanChange(plan.code, "monthly")}
                          type="button"
                        >
                          {isCurrent
                            ? "Current plan"
                            : plan.code === "free"
                              ? "Downgrade to Free"
                              : `Upgrade to ${plan.name}`}
                        </button>
                        {plan.code !== "free" ? (
                          <button
                            className="btn-secondary"
                            disabled={billingLoading}
                            onClick={() => handlePlanChange(plan.code, "yearly")}
                            type="button"
                          >
                            Yearly billing
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <SectionCard
              eyebrow="Invoices"
              title="Billing and payment history"
              description="Recurring account billing stays separate from trade escrow, with invoice-ready payment records."
            >
              <div className="space-y-4">
                {data.subscription.payments.length ? (
                  data.subscription.payments.map((payment) => (
                    <div key={payment.id} className="surface-muted p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-primary">
                            {payment.planName} | {payment.billingCycle}
                          </p>
                          <p className="text-sm text-muted">
                            {payment.invoiceNumber} | {payment.reference}
                          </p>
                        </div>
                        <StatusBadge value={payment.status} />
                      </div>
                      <p className="mt-3 text-sm text-muted">
                        {formatCurrency(payment.amount, payment.currency)} on{" "}
                        {formatDate(payment.paidAt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="No subscription invoices yet"
                    description="Activate a paid plan to begin building billing history."
                  />
                )}
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Transactions"
              title="Trade transaction history"
              description="Escrow-style trade states are tracked separately from account billing."
            >
              <div className="space-y-4">
                {data.transactions.items.length ? (
                  data.transactions.items.map((transaction) => (
                    <div key={transaction.id} className="surface-muted p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-primary">
                            {formatCurrency(transaction.amount, transaction.currency)}
                          </p>
                          <p className="text-sm text-muted">
                            {transaction.provider} | {transaction.paymentMethod || "Pending method"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge value={transaction.status} />
                          <StatusBadge value={transaction.escrowStatus} />
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-muted">
                        Buyer: {transaction.buyer?.companyName || "Unknown"} | Exporter:{" "}
                        {transaction.exporter?.companyName || "Unknown"}
                      </p>
                      {role === "buyer" && transaction.status === "in_escrow" ? (
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            className="btn-primary"
                            onClick={() => updateTransaction(transaction.id, "confirm-delivery")}
                            type="button"
                          >
                            Confirm delivery
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() =>
                              updateTransaction(
                                transaction.id,
                                "dispute",
                                "Buyer raised a delivery issue."
                              )
                            }
                            type="button"
                          >
                            Raise dispute
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="No transactions yet"
                    description="Secure trade records will appear here once buyers and exporters move into the payment flow."
                  />
                )}
              </div>
            </SectionCard>
          </div>

          <div className="mt-6">
            <SectionCard
              eyebrow="Notifications"
              title="Channel preferences"
              description="Choose how GenuineTrade reaches you for operational, payment, and subscription updates."
            >
              <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-4">
                  {[
                    [
                      "email",
                      "Email",
                      data.notificationSettings?.providers?.email || "not_configured"
                    ],
                    [
                      "sms",
                      "SMS",
                      data.notificationSettings?.providers?.sms || "not_configured"
                    ],
                    ["inApp", "In-app", "platform"]
                  ].map(([channel, label, provider]) => (
                    <div key={channel} className="surface-muted p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-primary">{label}</p>
                          <p className="text-sm text-muted">Provider: {provider}</p>
                        </div>
                        <input
                          checked={Boolean(data.notificationSettings?.[channel]?.enabled)}
                          className="h-4 w-4"
                          onChange={(event) =>
                            updateNotificationPreference(
                              channel,
                              "enabled",
                              event.target.checked
                            )
                          }
                          type="checkbox"
                        />
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {["rfq", "match", "payment", "subscription"].map((preferenceKey) => (
                          <label
                            key={`${channel}-${preferenceKey}`}
                            className="surface-muted flex items-center gap-3 px-4 py-3 text-sm text-primary"
                          >
                            <input
                              checked={Boolean(
                                data.notificationSettings?.[channel]?.[preferenceKey]
                              )}
                              className="h-4 w-4"
                              onChange={(event) =>
                                updateNotificationPreference(
                                  channel,
                                  preferenceKey,
                                  event.target.checked
                                )
                              }
                              type="checkbox"
                            />
                            {preferenceKey}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="surface-muted p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-primary">Phone verification</p>
                      <p className="mt-2 text-sm text-muted">
                        Verify your phone to unlock SMS alerts and future OTP-secured actions.
                      </p>
                    </div>
                    <StatusBadge
                      value={
                        data.notificationSettings?.phoneVerified
                          ? "verified"
                          : "not verified"
                      }
                    />
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                    <input
                      className="field"
                      onChange={(event) => setOtpCode(event.target.value)}
                      placeholder="Enter OTP code"
                      value={otpCode}
                    />
                    <button
                      className="btn-secondary"
                      disabled={notificationLoading}
                      onClick={sendOtp}
                      type="button"
                    >
                      Send OTP
                    </button>
                    <button
                      className="btn-primary"
                      disabled={notificationLoading || !otpCode.trim()}
                      onClick={verifyOtp}
                      type="button"
                    >
                      Verify
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </>
      ) : null}

      {role === "admin" ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="MRR" value={formatCurrency(data.subscription.summary.mrr)} />
            <StatCard label="Paid users" value={data.subscription.summary.paidUsers} />
            <StatCard label="Free users" value={data.subscription.summary.freeUsers} />
            <StatCard label="Expiring soon" value={data.subscription.summary.expiringSoon} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <SectionCard
              eyebrow="Subscriptions"
              title="Subscription operations"
              description="Monitor revenue, plan mix, and override accounts manually when sales or support needs it."
            >
              <div className="grid gap-4 md:grid-cols-3">
                {Object.entries(data.subscription.summary.planDistribution).map(
                  ([planCode, count]) => (
                    <div key={planCode} className="surface-muted p-4">
                      <p className="text-sm text-muted">{planCode}</p>
                      <p className="mt-2 text-xl font-semibold text-primary">{count}</p>
                    </div>
                  )
                )}
              </div>

              <div className="mt-6 space-y-4">
                {data.subscription.items.length ? (
                  data.subscription.items.map((subscription) => (
                    <div key={subscription.id} className="surface-muted p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-primary">
                            {subscription.user?.email}
                          </p>
                          <p className="text-sm text-muted">
                            {subscription.user?.role} | {subscription.planName}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge value={subscription.status} />
                          <button
                            className="btn-secondary"
                            onClick={() =>
                              setAdminOverride({
                                open: true,
                                subscriptionId: subscription.id,
                                planCode: subscription.planCode,
                                billingCycle: subscription.billingCycle,
                                status: subscription.status,
                                notes: ""
                              })
                            }
                            type="button"
                          >
                            Edit plan
                          </button>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-muted">
                        {formatCurrency(subscription.amount, subscription.currency)} | Renewal:{" "}
                        {formatDate(subscription.nextChargeAt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="No subscription records yet"
                    description="Account billing records will appear here once users activate plans."
                  />
                )}
              </div>
              <PaginationControls
                pagination={data.subscription.pagination}
                onPageChange={setSubscriptionPage}
              />
            </SectionCard>

            <SectionCard
              eyebrow="Transactions"
              title="Trade payment operations"
              description="Escrow state, disputes, and provider routing remain visible for operational teams."
            >
              <div className="space-y-4">
                {data.transactions.items.length ? (
                  data.transactions.items.map((transaction) => (
                    <div key={transaction.id} className="surface-muted p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-primary">
                            {formatCurrency(transaction.amount, transaction.currency)}
                          </p>
                          <p className="text-sm text-muted">
                            {transaction.provider} | {transaction.buyer?.companyName} to{" "}
                            {transaction.exporter?.companyName}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge value={transaction.status} />
                          <StatusBadge value={transaction.escrowStatus} />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="No trade transactions yet"
                    description="Trade payment operations will appear here once buyers create transactions."
                  />
                )}
              </div>
            </SectionCard>
          </div>

          <ActionModal
            description="Use this for manual sales-assisted upgrades, downgrades, and account recovery."
            onClose={() => setAdminOverride(initialAdminOverride)}
            open={adminOverride.open}
            title="Override subscription"
          >
            <form className="space-y-4" onSubmit={submitAdminOverride}>
              <div>
                <label className="label" htmlFor="planCode">
                  Plan
                </label>
                <select
                  id="planCode"
                  className="field"
                  onChange={(event) =>
                    setAdminOverride((current) => ({
                      ...current,
                      planCode: event.target.value
                    }))
                  }
                  value={adminOverride.planCode}
                >
                  <option value="free">Free</option>
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="billingCycle">
                    Billing cycle
                  </label>
                  <select
                    id="billingCycle"
                    className="field"
                    onChange={(event) =>
                      setAdminOverride((current) => ({
                        ...current,
                        billingCycle: event.target.value
                      }))
                    }
                    value={adminOverride.billingCycle}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="status">
                    Status
                  </label>
                  <select
                    id="status"
                    className="field"
                    onChange={(event) =>
                      setAdminOverride((current) => ({
                        ...current,
                        status: event.target.value
                      }))
                    }
                    value={adminOverride.status}
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>
              <FormField
                label="Notes"
                name="notes"
                onChange={(event) =>
                  setAdminOverride((current) => ({
                    ...current,
                    notes: event.target.value
                  }))
                }
                placeholder="Sales-assisted upgrade, support override, etc."
                value={adminOverride.notes}
              />
              <button className="btn-primary w-full" disabled={billingLoading} type="submit">
                {billingLoading ? "Saving..." : "Save override"}
              </button>
            </form>
          </ActionModal>
        </>
      ) : null}
    </AppShell>
  );
}
