"use client";

import { useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { formatFileSize } from "@/lib/files";

const isPreviewableImage = (file) =>
  Boolean(file?.type?.startsWith("image/"));

const getDropMessage = (rejections, { maxFiles, maxSize, multiple }) => {
  const firstError = rejections?.[0]?.errors?.[0];

  if (!firstError) {
    return "These files could not be uploaded. Check the format and size, then try again.";
  }

  if (firstError.code === "file-too-large" && maxSize) {
    return `Each file must be ${formatFileSize(maxSize)} or smaller.`;
  }

  if (firstError.code === "too-many-files") {
    if (multiple && maxFiles) {
      return `You can upload up to ${maxFiles} files here.`;
    }

    return "Only one file can be uploaded here.";
  }

  if (firstError.code === "file-invalid-type") {
    return "This file type is not supported. Use PDF, JPG, PNG, or WEBP.";
  }

  return "These files could not be uploaded. Check the format and size, then try again.";
};

export default function FileUploadField({
  label,
  accept,
  multiple = false,
  maxFiles,
  maxSize,
  onFilesChange,
  selectedFiles = [],
  selectedNames = [],
  helper = "",
  error = ""
}) {
  const [previewUrls, setPreviewUrls] = useState([]);
  const [dropError, setDropError] = useState("");

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    multiple,
    maxFiles: multiple ? maxFiles : 1,
    maxSize,
    onDrop: (acceptedFiles, rejectedFiles) => {
      setDropError(
        rejectedFiles.length
          ? getDropMessage(rejectedFiles, { maxFiles, maxSize, multiple })
          : ""
      );

      if (!acceptedFiles.length) {
        return;
      }

      if (multiple) {
        onFilesChange(acceptedFiles);
        return;
      }

      onFilesChange(acceptedFiles[0] || null);
    }
  });

  useEffect(() => {
    if (selectedFiles.length || selectedNames.length) {
      setDropError("");
    }
  }, [selectedFiles, selectedNames]);

  useEffect(() => {
    const nextUrls = selectedFiles
      .filter((file) => file instanceof File && isPreviewableImage(file))
      .map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file)
      }));

    setPreviewUrls(nextUrls);

    return () => {
      nextUrls.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [selectedFiles]);

  const fileCards = useMemo(() => {
    if (!selectedFiles.length) {
      return selectedNames.map((name) => ({
        name,
        size: "",
        previewUrl: ""
      }));
    }

    return selectedFiles.map((file) => {
      const preview = previewUrls.find((item) => item.name === file.name);

      return {
        name: file.name,
        size: formatFileSize(file.size),
        previewUrl: preview?.url || ""
      };
    });
  }, [previewUrls, selectedFiles, selectedNames]);

  const fieldError = error || dropError;

  return (
    <div>
      <label className="label">{label}</label>
      <div
        {...getRootProps()}
        className={`rounded-2xl border border-dashed px-5 py-6 shadow-sm transition duration-200 ${
          isDragActive
            ? "border-primary bg-primary/8 shadow-panel"
            : "border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/8"
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
            <span className="text-lg text-primary">+</span>
          </div>
          <p className="text-sm font-semibold text-primary">
            Drag & drop files or click to upload
          </p>
          <p className="mt-2 max-w-sm text-xs leading-6 text-muted">
            {helper || "PDF, JPG, PNG, and WEBP are supported."}
          </p>
        </div>
      </div>

      {fileCards.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {fileCards.map((file) => (
            <div
              key={file.name}
              className="rounded-2xl border border-line bg-white p-3 shadow-sm transition duration-200"
            >
              {file.previewUrl ? (
                <img
                  alt={file.name}
                  className="h-28 w-full rounded-xl object-cover"
                  src={file.previewUrl}
                />
              ) : (
                <div className="flex h-28 items-center justify-center rounded-xl bg-canvas text-sm font-semibold text-primary">
                  File ready
                </div>
              )}
              <p className="mt-3 truncate text-sm font-semibold text-ink">{file.name}</p>
              {file.size ? <p className="mt-1 text-xs text-muted">{file.size}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {fieldError ? <p className="mt-2 text-sm text-danger">{fieldError}</p> : null}
    </div>
  );
}
