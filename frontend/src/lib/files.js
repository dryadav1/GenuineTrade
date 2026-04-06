"use client";

import { API_ORIGIN } from "@/lib/api";

export const formatFileSize = (size = 0) => {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.readAsDataURL(file);
  });

export const readFileAsDataUrl = async (file, options = {}) => {
  if (!file) {
    return null;
  }

  const dataUrl = await readAsDataUrl(file);

  if (options.includeMetadata) {
    return {
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl
    };
  }

  return dataUrl;
};

export const readFilesAsDataUrls = async (files, options = {}) => {
  if (!files?.length) {
    return [];
  }

  return Promise.all(
    Array.from(files).map((file) => readFileAsDataUrl(file, options))
  );
};

export const openProtectedFile = async (downloadPath, token) => {
  const url = downloadPath?.startsWith("http")
    ? downloadPath
    : `${API_ORIGIN}${downloadPath}`;

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Unable to open the requested file.");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
};
