"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getSession, saveSession } from "@/lib/session";

export const useWorkspaceSession = () => {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const currentSession = getSession();

    if (!currentSession?.token) {
      setReady(true);
      router.replace("/login");
      return;
    }

    let cancelled = false;

    const hydrateSession = async () => {
      try {
        const data = await apiRequest("/auth/me", {
          token: currentSession.token
        });

        const nextSession = {
          ...currentSession,
          user: data.user
        };

        saveSession(nextSession);

        if (cancelled) {
          return;
        }

        setSession(nextSession);
        setReady(true);
      } catch (error) {
        clearSession();

        if (cancelled) {
          return;
        }

        setSession(null);
        setReady(true);
        router.replace("/login");
      }
    };

    hydrateSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const updateSessionUser = useCallback((user) => {
    const currentSession = getSession();
    if (!currentSession?.token || !user) {
      return;
    }

    const nextSession = {
      ...currentSession,
      user
    };

    saveSession(nextSession);
    setSession(nextSession);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    router.push("/login");
  }, [router]);

  return {
    session,
    ready,
    logout,
    updateSessionUser
  };
};
