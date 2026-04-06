"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OnboardingFrame from "@/components/onboarding/OnboardingFrame";
import FormField from "@/components/FormField";
import { apiRequest } from "@/lib/api";
import { getDashboardPath, getSession, saveSession } from "@/lib/session";

const initialState = {
  name: "",
  email: "",
  password: "",
  role: "exporter"
};

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const session = getSession();
    if (session?.user) {
      router.replace(getDashboardPath(session.user));
    }
  }, [router]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest("/auth/signup", {
        method: "POST",
        body: form
      });

      saveSession({
        token: data.token,
        user: data.user
      });

      router.push("/complete-profile");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingFrame
      eyebrow="Create account"
      title="Start with identity. Finish with a verified trade profile."
      description="Create your GenuineTrade account first, then we'll guide you through the role-specific profile details your team needs."
      asideTitle="What happens next"
      asideBody="After signup, exporter and buyer accounts both move into a guided multi-step onboarding flow. Once submitted, the account status becomes pending until an admin reviews the profile."
      footer={
        <p className="text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary">
            Login here
          </Link>
        </p>
      }
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/55">
          Signup
        </p>
        <h2 className="mt-3 text-3xl font-bold text-ink">Create your account</h2>
        <p className="mt-3 text-sm leading-7 text-muted">
          Choose whether you are onboarding as an exporter or a buyer. The next step adapts to
          your role and takes you into the new guided onboarding flow.
        </p>
      </div>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <FormField
          label="Full Name"
          name="name"
          onChange={handleChange}
          placeholder="Your full name"
          required
          value={form.name}
        />
        <FormField
          label="Email"
          name="email"
          onChange={handleChange}
          placeholder="name@company.com"
          required
          type="email"
          value={form.email}
        />
        <FormField
          label="Password"
          name="password"
          onChange={handleChange}
          placeholder="Minimum 6 characters"
          required
          type="password"
          value={form.password}
        />

        <div>
          <label className="label">Role Selection</label>
          <div className="grid gap-3 sm:grid-cols-2">
            {["exporter", "buyer"].map((role) => {
              const active = form.role === role;
              return (
                <button
                  key={role}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    active
                      ? "border-primary bg-primary text-white shadow-panel"
                      : "border-line bg-white text-ink hover:border-primary/30"
                  }`}
                  onClick={() => setForm((current) => ({ ...current, role }))}
                  type="button"
                >
                  <p className="text-sm font-semibold capitalize">{role}</p>
                  <p className={`mt-2 text-sm leading-6 ${active ? "text-white/80" : "text-muted"}`}>
                    {role === "exporter"
                      ? "Complete company verification and upload trade documents."
                      : "Share your company details and sourcing requirements."}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <button className="btn-primary w-full" disabled={loading} type="submit">
          {loading ? "Creating account..." : "Continue to onboarding"}
        </button>
      </form>
    </OnboardingFrame>
  );
}
