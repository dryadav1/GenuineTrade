"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useAdminContext } from "@/components/admin/AdminLayoutClient";

const toQueryString = (params = {}) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    query.set(key, String(value));
  });

  const result = query.toString();
  return result ? `?${result}` : "";
};

export const useAdminFetch = (path, params = {}, { enabled = true } = {}) => {
  const { session } = useAdminContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const queryString = useMemo(() => toQueryString(params), [params]);

  const load = useCallback(async () => {
    if (!enabled || !session?.token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await apiRequest(`${path}${queryString}`, {
        token: session.token
      });
      setData(response);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [enabled, path, queryString, session?.token]);

  useEffect(() => {
    if (!session?.token || !enabled) {
      setLoading(false);
      return;
    }

    load();
  }, [enabled, load, session?.token]);

  return {
    data,
    loading,
    error,
    reload: load,
    setData
  };
};
