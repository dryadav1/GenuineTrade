"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FormField from "@/components/FormField";
import StatusBadge from "@/components/StatusBadge";
import CountrySelectField from "@/components/onboarding/CountrySelectField";
import FileUploadField from "@/components/onboarding/FileUploadField";
import HsnCodeSelectField from "@/components/onboarding/HsnCodeSelectField";
import OnboardingFrame from "@/components/onboarding/OnboardingFrame";
import PhoneNumberField, {
  isValidPhoneValue
} from "@/components/onboarding/PhoneNumberField";
import ProductTagField from "@/components/onboarding/ProductTagField";
import { API_ORIGIN, apiRequest } from "@/lib/api";
import {
  formatFileSize,
  readFileAsDataUrl,
  readFilesAsDataUrls
} from "@/lib/files";
import { useWorkspaceSession } from "@/lib/workspace";

const splitTags = (value = "") =>
  String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const mapUserToForm = (user) => ({
  name: user?.name || "",
  company: user?.company || "",
  country: user?.country || "",
  phone: user?.phone || "",
  iec: user?.iec || "",
  gst: user?.gst || "",
  hsnCode: user?.hsnCode || "",
  productName: user?.productName || "",
  productCategory: splitTags(user?.productCategory || ""),
  importId: user?.importId || "",
  requirement: splitTags(user?.requirement || "")
});

const initialFiles = {
  iecFile: null,
  gstFile: null,
  productImages: []
};

const initialErrors = {
  name: "",
  company: "",
  country: "",
  phone: "",
  iec: "",
  gst: "",
  hsnCode: "",
  productName: "",
  product: "",
  importId: "",
  iecFile: "",
  gstFile: ""
};

const documentFieldAccept = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"]
};

const MAX_DOCUMENT_FILE_SIZE = 8 * 1024 * 1024;
const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_PRODUCT_IMAGE_COUNT = 6;
const MAX_ONBOARDING_UPLOAD_BYTES = 22 * 1024 * 1024;

const resolveAssetUrl = (value) => {
  if (!value) {
    return "";
  }

  if (value.startsWith("http")) {
    return value;
  }

  return `${API_ORIGIN}${value}`;
};

const getFileLabel = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  const segments = String(value).split("/");
  return segments[segments.length - 1];
};

function StepPill({ active, completed, index, title, onClick, disabled = false }) {
  return (
    <button
      className={`flex min-w-[140px] flex-1 items-center gap-3 rounded-[24px] border px-4 py-3 text-left transition ${
        active
          ? "border-primary bg-primary text-white shadow-panel"
          : completed
            ? "border-accent/20 bg-accent/10 text-primary"
            : "border-line bg-white text-primary/70"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-xs font-bold ${
          active
            ? "bg-white/14 text-white"
            : completed
              ? "bg-accent/20 text-success"
              : "bg-primary/6 text-primary"
        }`}
      >
        {completed ? "OK" : `0${index + 1}`}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className={`text-xs ${active ? "text-white/72" : "text-primary/45"}`}>
          {completed ? "Completed" : "Current step"}
        </p>
      </div>
    </button>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3 text-sm last:border-b-0">
      <span className="text-muted">{label}</span>
      <span className="max-w-[58%] break-words text-right font-medium text-ink">{value}</span>
    </div>
  );
}

export default function CompleteProfilePage() {
  const router = useRouter();
  const { session, ready, logout, updateSessionUser } = useWorkspaceSession();
  const [form, setForm] = useState(mapUserToForm(null));
  const [files, setFiles] = useState(initialFiles);
  const [validationErrors, setValidationErrors] = useState(initialErrors);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpNotice, setOtpNotice] = useState("");
  const [otpError, setOtpError] = useState("");
  const [error, setError] = useState("");
  const [submittedResult, setSubmittedResult] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  const isExporter = session?.user?.role === "exporter";
  const existingDocuments = session?.user?.documents || {};
  const productTags = isExporter ? form.productCategory : form.requirement;
  const isPhoneVerified = Boolean(
    session?.user?.phoneVerified && session?.user?.phone === form.phone
  );
  const steps = useMemo(
    () => [
      { id: "role", title: "Role" },
      { id: "details", title: "Business details" },
      { id: "documents", title: isExporter ? "Documents" : "Trust checks" },
      { id: "review", title: "Submit" }
    ],
    [isExporter]
  );

  useEffect(() => {
    if (session?.user) {
      setForm(mapUserToForm(session.user));
    }
  }, [session?.user]);

  useEffect(() => {
    if (!ready || !session) {
      return;
    }

    if (session.user.role === "admin") {
      router.replace("/admin");
      return;
    }

    const loadProfile = async () => {
      try {
        const data = await apiRequest("/profile", {
          token: session.token
        });

        setForm(mapUserToForm(data.user));
        updateSessionUser(data.user);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [ready, router, session?.token, session?.user?.role, updateSessionUser]);

  const selectedFileNames = useMemo(
    () => ({
      iecFile: files.iecFile
        ? [files.iecFile.name]
        : existingDocuments.iecFile
          ? [getFileLabel(existingDocuments.iecFile, "Uploaded IEC certificate")]
          : [],
      gstFile: files.gstFile
        ? [files.gstFile.name]
        : existingDocuments.gstFile
          ? [getFileLabel(existingDocuments.gstFile, "Uploaded GST certificate")]
          : [],
      productImages:
        files.productImages.length > 0
          ? files.productImages.map((file) => file.name)
          : (existingDocuments.productImages || []).map((value, index) =>
              getFileLabel(value, `Product image ${index + 1}`)
            )
    }),
    [existingDocuments.gstFile, existingDocuments.iecFile, existingDocuments.productImages, files]
  );
  const selectedUploadBytes = useMemo(
    () =>
      [files.iecFile, files.gstFile, ...files.productImages].reduce(
        (total, file) => total + (file?.size || 0),
        0
      ),
    [files]
  );
  const uploadBudgetError =
    isExporter && selectedUploadBytes > MAX_ONBOARDING_UPLOAD_BYTES
      ? `New uploads total ${formatFileSize(
          selectedUploadBytes
        )}. Keep selected files under ${formatFileSize(MAX_ONBOARDING_UPLOAD_BYTES)} before submitting.`
      : "";

  const progress = Math.round(((currentStep + 1) / steps.length) * 100);

  const updateFormValue = (name, value) => {
    setForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const setFieldError = (field, message) => {
    setValidationErrors((current) => ({
      ...current,
      [field]: message
    }));
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    updateFormValue(name, value);

    if (validationErrors[name]) {
      setFieldError(name, "");
    }
  };

  const handleCountryChange = (value) => {
    updateFormValue("country", value);
    if (value) {
      setFieldError("country", "");
    }
  };

  const handlePhoneChange = (value) => {
    updateFormValue("phone", value);
    setOtpCode("");
    setOtpNotice("");
    setOtpError("");
  };

  const handleProductChange = (value) => {
    updateFormValue(isExporter ? "productCategory" : "requirement", value);
    if (value.length) {
      setFieldError("product", "");
    }
  };

  const handleHsnSelect = (option) => {
    setForm((current) => ({
      ...current,
      hsnCode: option?.code || "",
      productName:
        option?.productName && !current.productName ? option.productName : current.productName,
      productCategory:
        option?.productName && current.productCategory.length === 0
          ? [option.productName]
          : current.productCategory
    }));
  };

  const handleSingleFileChange = (field, file) => {
    setFiles((current) => ({
      ...current,
      [field]: file
    }));
    setFieldError(field, "");
    setError("");
  };

  const handleMultipleFilesChange = (field, nextFiles) => {
    setFiles((current) => ({
      ...current,
      [field]: nextFiles
    }));
    setError("");
  };

  const validateDetailsStep = () => {
    const nextErrors = {
      ...initialErrors,
      name: form.name ? "" : "Please enter your full name.",
      company: form.company ? "" : "Please enter your company name.",
      country: form.country ? "" : "Please select a country.",
      phone: !isValidPhoneValue(form.phone)
        ? "Please enter a valid phone number with country code."
        : !isPhoneVerified
          ? "Verify your phone number with OTP before continuing."
          : "",
      iec: isExporter && !form.iec ? "Please enter your IEC code." : "",
      gst: isExporter && !form.gst ? "Please enter your GST number." : "",
      hsnCode: isExporter && !form.hsnCode ? "Please select an HSN code." : "",
      productName:
        isExporter && !form.productName ? "Please enter your primary product name." : "",
      importId:
        !isExporter && !form.importId ? "Please enter your import license or business ID." : "",
      product: productTags.length ? "" : "Please add at least one product."
    };

    setValidationErrors(nextErrors);
    return Object.values(nextErrors).every((value) => !value);
  };

  const validateDocumentsStep = () => {
    if (!isExporter) {
      return true;
    }

    const iecFile =
      files.iecFile || existingDocuments.iecFile
        ? ""
        : "Upload your IEC certificate before continuing.";
    const gstFile =
      files.gstFile || existingDocuments.gstFile
        ? ""
        : "Upload your GST certificate before continuing.";

    setValidationErrors((current) => ({
      ...current,
      iecFile,
      gstFile
    }));

    return !iecFile && !gstFile && !uploadBudgetError;
  };

  const handleNextStep = () => {
    setError("");

    if (currentStep === 1 && !validateDetailsStep()) {
      return;
    }

    if (currentStep === 2 && !validateDocumentsStep()) {
      return;
    }

    setCurrentStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleSendOtp = async () => {
    if (!session?.token) {
      return;
    }

    if (!isValidPhoneValue(form.phone)) {
      setFieldError("phone", "Please enter a valid phone number with country code.");
      return;
    }

    setSendingOtp(true);
    setOtpError("");
    setOtpNotice("");

    try {
      const data = await apiRequest("/profile/phone/send-otp", {
        method: "POST",
        token: session.token,
        body: {
          phone: form.phone
        }
      });

      updateSessionUser(data.user);
      setOtpNotice(
        data.debugCode
          ? `OTP sent. Local debug code: ${data.debugCode}`
          : "OTP sent successfully. Check your SMS inbox."
      );
    } catch (requestError) {
      setOtpError(requestError.message);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!session?.token) {
      return;
    }

    if (!/^\d{6}$/.test(otpCode.trim())) {
      setOtpError("Enter the 6-digit OTP code.");
      return;
    }

    setVerifyingOtp(true);
    setOtpError("");
    setOtpNotice("");

    try {
      const data = await apiRequest("/profile/phone/verify-otp", {
        method: "POST",
        token: session.token,
        body: {
          code: otpCode.trim()
        }
      });

      updateSessionUser(data.user);
      setOtpCode("");
      setFieldError("phone", "");
      setOtpNotice("Phone verified successfully.");
    } catch (requestError) {
      setOtpError(requestError.message);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!session?.token) {
      return;
    }

    const detailsValid = validateDetailsStep();
    const documentsValid = validateDocumentsStep();

    if (!detailsValid || !documentsValid) {
      setCurrentStep(detailsValid ? 2 : 1);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const documents = {};

      if (files.iecFile) {
        documents.iecFile = await readFileAsDataUrl(files.iecFile, {
          includeMetadata: true
        });
      }

      if (files.gstFile) {
        documents.gstFile = await readFileAsDataUrl(files.gstFile, {
          includeMetadata: true
        });
      }

      if (files.productImages.length > 0) {
        documents.productImages = await readFilesAsDataUrls(files.productImages, {
          includeMetadata: true
        });
      }

      const body = {
        ...form,
        productCategory: form.productCategory.join(", "),
        requirement: form.requirement.join(", "),
        ...(Object.keys(documents).length ? { documents } : {})
      };

      const data = await apiRequest("/profile", {
        method: "PUT",
        token: session.token,
        body
      });

      updateSessionUser(data.user);
      setSubmittedResult({
        message: data.message || "Your profile is under verification.",
        user: data.user
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  if (!ready || !session) {
    return (
      <OnboardingFrame
        eyebrow="Complete profile"
        title="Preparing your onboarding workspace."
        description="Loading your account details and current verification state."
        asideTitle="Verification flow"
        asideBody="Every account starts in pending status until an admin reviews the submitted profile and documents."
        compact
      >
        <div className="space-y-4">
          <div className="surface-muted h-24 animate-pulse" />
          <div className="surface-muted h-24 animate-pulse" />
        </div>
      </OnboardingFrame>
    );
  }

  if (submittedResult) {
    return (
      <OnboardingFrame
        eyebrow="Onboarding complete"
        title="Your profile has been submitted for review."
        description="The onboarding flow is complete and the workspace is now ready for admin verification."
        asideTitle="What happens next"
        asideBody="Admins can approve, reject, or request changes from the control workspace. Your dashboard remains available so you can review details and monitor status."
        compact
      >
        <div className="flex flex-wrap gap-2">
          <StatusBadge value={submittedResult.user?.status || "pending"} />
          <StatusBadge value={submittedResult.user?.badge || "none"} />
        </div>

        <div className="mt-6 rounded-[28px] border border-accent/20 bg-accent/10 p-5">
          <p className="text-sm font-semibold text-success">Submission received</p>
          <p className="mt-2 text-sm leading-7 text-muted">{submittedResult.message}</p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="surface-muted p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
              Account
            </p>
            <p className="mt-3 text-lg font-bold text-ink">{submittedResult.user?.name}</p>
            <p className="mt-2 text-sm text-muted">{submittedResult.user?.email}</p>
          </div>
          <div className="surface-muted p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
              Role
            </p>
            <p className="mt-3 text-lg font-bold capitalize text-ink">
              {submittedResult.user?.role}
            </p>
            <p className="mt-2 text-sm text-muted">
              {submittedResult.user?.profileCompleted
                ? "Profile completed and queued for review."
                : "Profile still requires updates."}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/dashboard" className="btn-primary">
            Open dashboard
          </Link>
          <Link href="/pricing" className="btn-secondary">
            Review plans
          </Link>
        </div>
      </OnboardingFrame>
    );
  }

  if (loading) {
    return (
      <OnboardingFrame
        eyebrow="Complete profile"
        title="Loading your onboarding checklist."
        description="Fetching your latest profile details, verification status, and uploaded files."
        asideTitle="Verification flow"
        asideBody="We keep your current onboarding state in sync before you continue with the final submission."
        compact
      >
        <div className="space-y-4">
          <div className="surface-muted h-32 animate-pulse" />
          <div className="surface-muted h-24 animate-pulse" />
          <div className="surface-muted h-24 animate-pulse" />
        </div>
      </OnboardingFrame>
    );
  }

  return (
    <OnboardingFrame
      eyebrow="Complete profile"
      title="Finish your GenuineTrade onboarding."
      description="A guided onboarding flow helps you confirm your role, complete business details, upload trust assets, and submit a clean profile for review."
      asideTitle="Launch checklist"
      asideBody="Every exporter and buyer now moves through the same high-confidence sequence so admin review stays cleaner and the workspace feels predictable."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Need to pause? Your progress stays in this session until you save the profile.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard" className="btn-secondary">
              Back to dashboard
            </Link>
            <button className="btn-secondary" onClick={logout} type="button">
              Logout
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/55">
            Step {currentStep + 1} of {steps.length}
          </p>
          <h2 className="mt-3 text-3xl font-bold text-ink">Complete your profile</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge value={session.user.status || "pending"} />
          <StatusBadge value={session.user.badge || "none"} />
        </div>
      </div>

      <div className="mt-6 rounded-[28px] border border-line bg-canvas/80 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Onboarding progress</p>
            <p className="mt-2 text-sm text-muted">
              Move through the guided sequence to submit a review-ready profile.
            </p>
          </div>
          <span className="rounded-full bg-primary/8 px-4 py-2 text-sm font-semibold text-primary">
            {progress}% complete
          </span>
        </div>

        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          {steps.map((step, index) => (
            <StepPill
              key={step.id}
              active={currentStep === index}
              completed={index < currentStep}
              disabled={index > currentStep}
              index={index}
              onClick={() => {
                if (index <= currentStep) {
                  setCurrentStep(index);
                }
              }}
              title={step.title}
            />
          ))}
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {currentStep === 0 ? (
        <div className="mt-8 space-y-6">
          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="surface-muted p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
                Selected role
              </p>
              <h3 className="mt-3 text-2xl font-bold capitalize text-ink">{session.user.role}</h3>
              <p className="mt-3 text-sm leading-7 text-muted">
                {isExporter
                  ? "Exporters add business identity, product data, and verification documents before buyers can trust the profile."
                  : "Buyers add company identity, sourcing requirements, and phone verification before procurement activity begins."}
              </p>
            </div>
            <div className="surface-muted p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
                This flow includes
              </p>
              <div className="mt-4 space-y-3 text-sm leading-7 text-muted">
                <p>1. Role confirmation and trust expectations.</p>
                <p>2. Business details with validation and phone OTP.</p>
                <p>3. Documents and review readiness.</p>
                <p>4. Submission with a success confirmation screen.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" onClick={handleNextStep} type="button">
              Continue to business details
            </button>
            <Link href="/dashboard" className="btn-secondary">
              Back to dashboard
            </Link>
          </div>
        </div>
      ) : null}

      {currentStep === 1 ? (
        <div className="mt-8 space-y-8">
          <section className="grid gap-5 md:grid-cols-2">
            <FormField error={validationErrors.name} label="Full Name" name="name" onChange={handleChange} placeholder="Your full name" required value={form.name} />
            <FormField error={validationErrors.company} label="Company Name" name="company" onChange={handleChange} placeholder="Your company" required value={form.company} />
            <CountrySelectField error={validationErrors.country} label="Country" onChange={handleCountryChange} value={form.country} />
            <div className="space-y-3">
              <PhoneNumberField error={validationErrors.phone} onChange={handlePhoneChange} value={form.phone} />
              <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">Phone OTP verification</p>
                    <p className="mt-1 text-xs leading-6 text-muted">Verify this number before continuing to the final review step.</p>
                  </div>
                  {isPhoneVerified ? <span className="rounded-full bg-accent/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-success">Verified</span> : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button className="btn-secondary" disabled={sendingOtp || !isValidPhoneValue(form.phone)} onClick={handleSendOtp} type="button">
                    {sendingOtp ? "Sending..." : "Send OTP"}
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input
                    className="field"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    value={otpCode}
                  />
                  <button className="btn-primary" disabled={verifyingOtp || otpCode.trim().length !== 6} onClick={handleVerifyOtp} type="button">
                    {verifyingOtp ? "Verifying..." : "Verify OTP"}
                  </button>
                </div>

                {otpNotice ? <p className="mt-3 text-sm text-success">{otpNotice}</p> : null}
                {otpError ? <p className="mt-3 text-sm text-danger">{otpError}</p> : null}
              </div>
            </div>
          </section>

          {isExporter ? (
            <section className="grid gap-5 md:grid-cols-2">
              <FormField error={validationErrors.iec} label="IEC Code" name="iec" onChange={handleChange} placeholder="Importer Exporter Code" required value={form.iec} />
              <FormField error={validationErrors.gst} label="GST Number" name="gst" onChange={handleChange} placeholder="GST Number" required value={form.gst} />
              <HsnCodeSelectField error={validationErrors.hsnCode} onChange={handleHsnSelect} value={form.hsnCode} />
              <FormField error={validationErrors.productName} label="Primary Product Name" name="productName" onChange={handleChange} placeholder="Auto-filled from HSN or enter manually" required value={form.productName} />
              <div className="md:col-span-2">
                <ProductTagField error={validationErrors.product} helper="Type a product and press enter to add multiple export categories." label="Products" onChange={handleProductChange} placeholder="Add products like Turmeric, Rice, Spices" value={form.productCategory} />
              </div>
            </section>
          ) : (
            <section className="grid gap-5 md:grid-cols-2">
              <FormField error={validationErrors.importId} label="Import License / Business ID" name="importId" onChange={handleChange} placeholder="Business identifier" required value={form.importId} />
              <div className="md:col-span-2">
                <ProductTagField error={validationErrors.product} helper="Add one or more product requirements as tags." label="Product Requirement" onChange={handleProductChange} placeholder="Add products like Rice, Spices, Tea" value={form.requirement} />
              </div>
            </section>
          )}

          <div className="flex flex-wrap gap-3">
            <button className="btn-secondary" onClick={() => setCurrentStep(0)} type="button">
              Back
            </button>
            <button className="btn-primary" onClick={handleNextStep} type="button">
              Continue to {steps[2].title.toLowerCase()}
            </button>
          </div>
        </div>
      ) : null}

      {currentStep === 2 ? (
        <div className="mt-8 space-y-8">
          {isExporter ? (
            <>
              <section className="grid gap-5 md:grid-cols-2">
                <div>
                  <FileUploadField
                    accept={documentFieldAccept}
                    error={validationErrors.iecFile}
                    helper={`Upload IEC certificate in PDF or image format. Max ${formatFileSize(
                      MAX_DOCUMENT_FILE_SIZE
                    )}.`}
                    label="IEC Certificate"
                    maxSize={MAX_DOCUMENT_FILE_SIZE}
                    onFilesChange={(file) => handleSingleFileChange("iecFile", file)}
                    selectedFiles={files.iecFile ? [files.iecFile] : []}
                    selectedNames={selectedFileNames.iecFile}
                  />
                </div>
                <div>
                  <FileUploadField
                    accept={documentFieldAccept}
                    error={validationErrors.gstFile}
                    helper={`Upload GST certificate in PDF or image format. Max ${formatFileSize(
                      MAX_DOCUMENT_FILE_SIZE
                    )}.`}
                    label="GST Certificate"
                    maxSize={MAX_DOCUMENT_FILE_SIZE}
                    onFilesChange={(file) => handleSingleFileChange("gstFile", file)}
                    selectedFiles={files.gstFile ? [files.gstFile] : []}
                    selectedNames={selectedFileNames.gstFile}
                  />
                </div>
                <div className="md:col-span-2">
                  <FileUploadField
                    accept={{
                      "image/jpeg": [".jpg", ".jpeg"],
                      "image/png": [".png"],
                      "image/webp": [".webp"]
                    }}
                    helper={`Upload up to ${MAX_PRODUCT_IMAGE_COUNT} product images, ${formatFileSize(
                      MAX_PRODUCT_IMAGE_SIZE
                    )} each. Keep total new uploads under ${formatFileSize(
                      MAX_ONBOARDING_UPLOAD_BYTES
                    )}.`}
                    label="Product Images"
                    maxFiles={MAX_PRODUCT_IMAGE_COUNT}
                    maxSize={MAX_PRODUCT_IMAGE_SIZE}
                    multiple
                    onFilesChange={(nextFiles) =>
                      handleMultipleFilesChange("productImages", nextFiles)
                    }
                    selectedFiles={files.productImages}
                    selectedNames={selectedFileNames.productImages}
                  />
                </div>
              </section>

              <section className="surface-muted p-5">
                <p className="text-sm font-semibold text-ink">Upload budget</p>
                <p className="mt-2 text-sm text-muted">
                  New files selected: {formatFileSize(selectedUploadBytes)} of{" "}
                  {formatFileSize(MAX_ONBOARDING_UPLOAD_BYTES)}.
                </p>
                {uploadBudgetError ? (
                  <p className="mt-3 text-sm text-danger">{uploadBudgetError}</p>
                ) : (
                  <p className="mt-3 text-sm text-success">
                    Selected files are within the onboarding upload limit.
                  </p>
                )}
              </section>

              {existingDocuments.iecFile || existingDocuments.gstFile || existingDocuments.productImages?.length ? (
                <section className="surface-muted p-5">
                  <p className="text-sm font-semibold text-ink">Previously uploaded documents</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {existingDocuments.iecFile ? <a className="btn-secondary" href={resolveAssetUrl(existingDocuments.iecFile)} rel="noreferrer" target="_blank">View IEC file</a> : null}
                    {existingDocuments.gstFile ? <a className="btn-secondary" href={resolveAssetUrl(existingDocuments.gstFile)} rel="noreferrer" target="_blank">View GST file</a> : null}
                    {(existingDocuments.productImages || []).map((imagePath, index) => (
                      <a key={`${imagePath}-${index}`} className="btn-secondary" href={resolveAssetUrl(imagePath)} rel="noreferrer" target="_blank">
                        View product image {index + 1}
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="surface-muted p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">Buyer trust checks</p>
                <h3 className="mt-3 text-2xl font-bold text-ink">No document upload required.</h3>
                <p className="mt-3 text-sm leading-7 text-muted">Buyer onboarding focuses on company identity, product demand, and phone verification. Your admin team can still review and verify the profile from the control workspace.</p>
              </div>
              <div className="surface-muted p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">Readiness checklist</p>
                <div className="mt-4 space-y-3 text-sm leading-7 text-muted">
                  <p>1. Company details added.</p>
                  <p>2. Product requirements defined.</p>
                  <p>3. Phone number verified by OTP.</p>
                  <p>4. Profile ready for admin review.</p>
                </div>
              </div>
            </section>
          )}

          <div className="flex flex-wrap gap-3">
            <button className="btn-secondary" onClick={() => setCurrentStep(1)} type="button">
              Back
            </button>
            <button className="btn-primary" onClick={handleNextStep} type="button">
              Continue to review
            </button>
          </div>
        </div>
      ) : null}

      {currentStep === 3 ? (
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <section className="rounded-3xl border border-line bg-white p-6 shadow-panel">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">Business summary</p>
              <h3 className="mt-3 text-2xl font-bold text-ink">Review your details</h3>
              <div className="mt-5 space-y-1">
                <SummaryItem label="Role" value={session.user.role} />
                <SummaryItem label="Full name" value={form.name || "Not provided"} />
                <SummaryItem label="Company" value={form.company || "Not provided"} />
                <SummaryItem label="Country" value={form.country || "Not provided"} />
                <SummaryItem label="Phone" value={isPhoneVerified ? `${form.phone} (Verified)` : form.phone || "Not provided"} />
                {isExporter ? (
                  <>
                    <SummaryItem label="IEC" value={form.iec || "Not provided"} />
                    <SummaryItem label="GST" value={form.gst || "Not provided"} />
                    <SummaryItem label="HSN" value={form.hsnCode || "Not provided"} />
                    <SummaryItem label="Primary product" value={form.productName || "Not provided"} />
                  </>
                ) : (
                  <SummaryItem label="Import ID" value={form.importId || "Not provided"} />
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-line bg-white p-6 shadow-panel">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">Submission readiness</p>
              <h3 className="mt-3 text-2xl font-bold text-ink">Final check before submit</h3>
              <div className="mt-5 space-y-4">
                <div className="surface-muted p-4">
                  <p className="text-sm font-semibold text-ink">Products / requirements</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {productTags.length ? productTags.map((item) => (
                      <span key={item} className="rounded-full bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary">
                        {item}
                      </span>
                    )) : <span className="text-sm text-muted">No products added yet.</span>}
                  </div>
                </div>
                <div className="surface-muted p-4">
                  <p className="text-sm font-semibold text-ink">Document status</p>
                  <div className="mt-3 space-y-2 text-sm text-muted">
                    <p>IEC certificate: {isExporter ? (selectedFileNames.iecFile.length ? "Ready" : "Missing") : "Not required"}</p>
                    <p>GST certificate: {isExporter ? (selectedFileNames.gstFile.length ? "Ready" : "Missing") : "Not required"}</p>
                    <p>Product images: {isExporter ? (selectedFileNames.productImages.length ? `${selectedFileNames.productImages.length} file(s)` : "Optional") : "Not required"}</p>
                    {isExporter ? (
                      <p>
                        New upload budget: {formatFileSize(selectedUploadBytes)} /{" "}
                        {formatFileSize(MAX_ONBOARDING_UPLOAD_BYTES)}
                      </p>
                    ) : null}
                  </div>
                  {uploadBudgetError ? (
                    <p className="mt-3 text-sm text-danger">{uploadBudgetError}</p>
                  ) : null}
                </div>
              </div>
            </section>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="btn-secondary" onClick={() => setCurrentStep(2)} type="button">
              Back
            </button>
            <button className="btn-primary" disabled={saving} type="submit">
              {saving ? "Submitting profile..." : "Submit profile for review"}
            </button>
          </div>
        </form>
      ) : null}
    </OnboardingFrame>
  );
}
