"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OnboardingFrame from "@/components/onboarding/OnboardingFrame";
import FormField from "@/components/FormField";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { useToast, useToastOnChange } from "@/components/feedback/ToastProvider";
import { apiRequest } from "@/lib/api";
import { getDashboardPath, getSession, saveSession } from "@/lib/session";

const initialState = {
  email: "",
  password: ""
};

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  useToastOnChange({
    errorMessage: error,
    errorTitle: "Login failed"
  });

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
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: form
      });

      saveSession({
        token: data.token,
        user: data.user
      });

      toast.success("You are signed in and your workspace is ready.", {
        title: "Welcome back"
      });
      router.push(getDashboardPath(data.user));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingFrame
      eyebrow="Login"
      title="Return to your onboarding and verification workspace."
      description="Password login is available for exporters, buyers, and admins. GenuineTrade keeps access simple while your verification decisions stay manual."
      asideTitle="Limited dashboard access"
      asideBody="Pending users can still view their profile, update information, and monitor their current verification status from the dashboard."
      compact
      footer={
        <p className="text-sm text-muted">
          New to GenuineTrade?{" "}
          <Link href="/signup" className="font-semibold text-primary">
            Create your account
          </Link>
        </p>
      }
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/55">
          Login
        </p>
        <h2 className="mt-3 text-3xl font-bold text-ink">Sign in</h2>
        <p className="mt-3 text-sm leading-7 text-muted">
          Use your email and password to continue onboarding or review your profile status.
        </p>
      </div>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
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
          placeholder="Enter your password"
          required
          type="password"
          value={form.password}
        />

        {error ? (
          <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <button className="btn-primary w-full" disabled={loading} type="submit">
          {loading ? (
            <>
              <LoadingSpinner className="h-4 w-4" tone="#FFFFFF" />
              Signing in...
            </>
          ) : (
            "Login"
          )}
        </button>
      </form>
    </OnboardingFrame>
  );
}
